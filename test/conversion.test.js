const assert = require('chai').assert;
const { JSDOM } = require('jsdom');
const { EMOJI_MAP, replaceEmojis } = require('../emoji.js');

let marked;
let TurndownService;

describe('Markdown conversion', function() {
  before(async function() {
    ({ marked } = await import('marked'));
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    delete require.cache[require.resolve('../turndown.js')];
    TurndownService = require('../turndown.js');
  });

  after(function() {
    delete global.window;
    delete global.document;
  });

  it('converts Markdown to HTML', function() {
    const html = marked.parse('# Hello').trim();
    assert.equal(html, '<h1>Hello</h1>');
  });

  it('parses Markdown containing emojis', function() {
    const html = marked.parse(replaceEmojis('I love it :heart:')).trim();
    assert.equal(html, '<p>I love it ❤️</p>');
  });

  it('supports emoji replacement', function() {
    assert.equal(replaceEmojis('Great job :tada:'), 'Great job 🎉');
  });

  it('leaves unknown emoji codes unchanged', function() {
    assert.equal(replaceEmojis('Unknown :notaremoji:'), 'Unknown :notaremoji:');
  });

  it('retains emoji characters already in the text', function() {
    assert.equal(marked.parse(replaceEmojis('Keep it 👍')).trim(), '<p>Keep it 👍</p>');
  });

  it('emoji map is extensive', function() {
    assert.isAbove(Object.keys(EMOJI_MAP).length, 1000);
  });

  it('converts HTML to Markdown with the shipped converter', function() {
    const td = new TurndownService();
    assert.equal(td.turndown('<strong>Hi</strong>').trim(), '**Hi**');
  });
});
