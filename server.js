// Name: MD SAHIL
// Roll number: 2500320100709

const http = require('node:http');

const products = [];
let nextId = 1;

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readProduct(req) {
  let body = '';
  req.setEncoding('utf8');
  for await (const chunk of req) body += chunk;

  const data = JSON.parse(body);
  if (typeof data?.name !== 'string' || !data.name.trim() ||
      typeof data.category !== 'string' || !data.category.trim() ||
      !Number.isFinite(data.price)) {
    throw new Error('Invalid product');
  }
  return { name: data.name.trim(), price: data.price, category: data.category.trim() };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const match = /^\/api\/products(?:\/([^/]+))?\/?$/.exec(url.pathname);
  if (!match) return send(res, 404, { error: 'Route not found' });

  const id = match[1];
  const isItem = id !== undefined;
  const index = isItem ? products.findIndex(p => String(p.id) === id) : -1;
  if (isItem && index === -1) return send(res, 404, { error: 'Product not found' });

  if (req.method === 'GET') {
    if (isItem) return send(res, 200, products[index]);
    const category = url.searchParams.get('category');
    return send(res, 200, category === null ? products : products.filter(p => p.category === category));
  }

  if (req.method === 'DELETE' && isItem) {
    const [removed] = products.splice(index, 1);
    return send(res, 200, removed);
  }

  if ((req.method === 'POST' && !isItem) || (req.method === 'PUT' && isItem)) {
    let data;
    try {
      data = await readProduct(req);
    } catch {
      return send(res, 400, { error: 'Provide a JSON object with name, price, and category' });
    }

    // A product may have been deleted while the request body was arriving.
    const existing = isItem && products.find(p => String(p.id) === id);
    if (isItem && !existing) return send(res, 404, { error: 'Product not found' });
    if (products.some(p => p !== existing && p.name.toLowerCase() === data.name.toLowerCase())) {
      return send(res, 409, { error: 'Product name already exists' });
    }
    if (isItem) return send(res, 200, Object.assign(existing, data));

    const product = { id: nextId++, ...data };
    products.push(product);
    return send(res, 201, product);
  }

  res.setHeader('Allow', isItem ? 'GET, PUT, DELETE' : 'GET, POST');
  send(res, 405, { error: 'Method not allowed' });
});

server.listen(3000, () => console.log('Products API running on http://localhost:3000'));
