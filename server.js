// Name: MD SAHIL
// Roll number: 2500320100709

const http = require('node:http');

const PORT = 3000;
const MAX_BODY_BYTES = 16 * 1024;

// Products are stored in memory and reset when the server restarts.
const products = [];
let nextId = 1;

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function methodNotAllowed(response, allowedMethods) {
  response.setHeader('Allow', allowedMethods);
  sendError(response, 405, 'Method not allowed');
}

async function readProduct(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
  }

  if (bytes > MAX_BODY_BYTES) {
    return { status: 413, error: 'Product JSON must be 16 KB or smaller' };
  }

  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return { status: 400, error: 'Request body must contain valid JSON' };
  }

  const { name, price, category } = data ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return { status: 400, error: 'Name must be non-empty text' };
  }
  if (!Number.isFinite(price)) {
    return { status: 400, error: 'Price must be a number' };
  }
  if (typeof category !== 'string' || !category.trim()) {
    return { status: 400, error: 'Category must be non-empty text' };
  }

  return { product: { name: name.trim(), price, category: category.trim() } };
}

async function saveProduct(request, response, existing) {
  const { product, status, error } = await readProduct(request);
  // A DELETE can finish while this request is still reading its body.
  if (existing && !products.includes(existing)) {
    return sendError(response, 404, 'Product not found');
  }
  if (error) return sendError(response, status, error);

  const name = product.name.toLowerCase();
  const duplicate = products.some(item => item !== existing && item.name.toLowerCase() === name);
  if (duplicate) return sendError(response, 409, 'Product name already exists');

  if (existing) {
    Object.assign(existing, product);
    return sendJson(response, 200, existing);
  }

  const created = { id: nextId++, ...product };
  products.push(created);
  sendJson(response, 201, created);
}

async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const route = /^\/api\/products(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (!route) return sendError(response, 404, 'Route not found');

  const [, id] = route;
  if (id === undefined) {
    switch (request.method) {
      case 'GET': {
        const category = url.searchParams.get('category');
        const results = category === null
          ? products
          : products.filter(product => product.category === category);
        return sendJson(response, 200, results);
      }
      case 'POST':
        return saveProduct(request, response);
      default:
        return methodNotAllowed(response, 'GET, POST');
    }
  }

  const index = products.findIndex(product => String(product.id) === id);
  if (index === -1) return sendError(response, 404, 'Product not found');

  switch (request.method) {
    case 'GET':
      return sendJson(response, 200, products[index]);
    case 'PUT':
      return saveProduct(request, response, products[index]);
    case 'DELETE': {
      const [removed] = products.splice(index, 1);
      return sendJson(response, 200, removed);
    }
    default:
      return methodNotAllowed(response, 'GET, PUT, DELETE');
  }
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch(error => {
    if (response.destroyed) return;
    if (error instanceof TypeError && error.code === 'ERR_INVALID_URL') {
      return sendError(response, 400, 'Invalid request URL');
    }
    console.error(error);
    sendError(response, 500, 'Internal server error');
  });
});

server.listen(PORT, () => {
  console.log(`Products API running at http://localhost:${PORT}/api/products`);
});
