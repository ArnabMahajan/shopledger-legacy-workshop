'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order pricing uses HSN rate and applies coupon before GST', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 100);
  assert.equal(totals.tax, 45);
  assert.equal(totals.cgst, 22.5);
  assert.equal(totals.sgst, 22.5);
  assert.equal(totals.total, 945);
  assert.equal(totals.lines[0].gstPercent, 5);
});

test('invoice figures match order pricing, including HSN GST and discount before tax', function () {
  var order = {
    id: 10,
    coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.tax, 45);
  assert.equal(figures.cgst, 22.5);
  assert.equal(figures.sgst, 22.5);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 945);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 45);
});

test('invoice discount honors the coupon maximum and matches billed tax and total', function () {
  var order = {
    id: 11,
    coupon: 'SAVE10',
    items: [{ id: 2, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }]
  };
  var figures = invoice.computeInvoiceFigures(order);
  var ledgerFigures = pricing.computeTotals(order.items, order.coupon);

  assert.equal(ledgerFigures.discount, 150);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.total, 1942.5);
});

test('invoice render shows separate CGST and SGST without a false mismatch notice', function () {
  var order = {
    id: 12,
    date: '01/01/2022',
    customer: 'Test Customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }]
  };
  var html = invoice.render(order);

  assert.match(html, /<td>CGST<\/td><td class="r">₹22\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹22\.50<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice display reflects the stored order discount and tax split', function () {
  var order = {
    id: 14,
    date: '01/01/2022',
    customer: 'Test Customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    total: 1942.5,
    items: [{ id: 3, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }]
  };
  var html = invoice.render(order);

  assert.match(html, /<td>CGST<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /-₹150\.00/);
  assert.match(html, /₹1942\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
