"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  activate: () => activate,
  nav: () => nav
});
module.exports = __toCommonJS(src_exports);
var import_coc = require("coc.nvim");
async function activate(context) {
  context.subscriptions.push(
    import_coc.workspace.registerAutocmd({
      event: "CursorMoved",
      callback: () => {
        nav();
      }
    })
  );
}
var kindOrder = [
  "",
  "file",
  "module",
  "namespace",
  "package",
  "class",
  "method",
  "property",
  "field",
  "constructor",
  "enum",
  "interface",
  "function",
  "variable",
  "constant",
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "key",
  "null",
  "enumMember",
  "struct",
  "event",
  "operator",
  "typeParameter"
];
var kindToLabel = (kind) => {
  const config = import_coc.workspace.getConfiguration("suggest.completionItemKindLabels");
  return config[kindOrder[kind]];
};
var comparePosition = (position, other) => {
  if (position.line > other.line)
    return 1;
  if (other.line === position.line && position.character > other.character)
    return 1;
  if (other.line === position.line && position.character === other.character)
    return 0;
  return -1;
};
var positionInRange = (position, range) => {
  const { start, end } = range;
  if (comparePosition(position, start) < 0)
    return -1;
  if (comparePosition(position, end) > 0)
    return 1;
  return 0;
};
var expandChildren = (symbol) => {
  var _a;
  const children = (_a = symbol.children) != null ? _a : [];
  return children.reduce(
    (acc, child) => {
      if (!Number.isNaN(parseInt(child.name, 10)))
        return acc;
      return [...acc, ...expandChildren(child)];
    },
    [symbol]
  );
};
var nav = async () => {
  const { document, position } = await import_coc.workspace.getCurrentState();
  const tokenSource = new import_coc.CancellationTokenSource();
  const bufnr = await import_coc.workspace.nvim.call("bufnr", ["%"]);
  const buffer = import_coc.workspace.nvim.createBuffer(bufnr);
  const filetype = await buffer.getOption("filetype");
  const providers = Array.from(import_coc.languages.documentSymbolManager.providers).filter(
    (v) => v.selector.includes(filetype) || v.selector.flatMap((s) => s == null ? void 0 : s.language).includes(filetype)
  );
  if (providers.length === 0)
    return;
  const provider = providers[0].provider;
  const symbols = (await provider.provideDocumentSymbols(document, tokenSource.token)).map((v) => expandChildren(v)).flat();
  let arr = [];
  for (const sym of symbols) {
    if (positionInRange(position, sym.range) === 0) {
      arr = [...arr, { name: sym.name, kind: sym.kind, label: kindToLabel(sym.kind) }];
    }
  }
  await buffer.setVar(
    "coc_nav",
    arr.map(({ name, kind, label }) => ({
      name,
      label,
      highlight: `CocSymbol${kindOrder[kind].charAt(0).toUpperCase()}${kindOrder[kind].slice(1)}`
    }))
  );
  import_coc.workspace.nvim.call("coc#util#do_autocmd", ["CocNavChanged"]);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  nav
});
