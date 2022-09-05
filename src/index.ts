import {
  CancellationTokenSource,
  DocumentSymbol,
  ExtensionContext,
  languages,
  Position,
  Range,
  SymbolKind,
  workspace,
} from 'coc.nvim';

export async function activate(context: ExtensionContext): Promise<void> {
  context.subscriptions.push(
    workspace.registerAutocmd({
      event: 'CursorHold',
      callback: () => {
        nav();
      },
    })
  );
}

const kindOrder = [
  'text',
  'method',
  'function',
  'constructor',
  'field',
  'variable',
  'class',
  'interface',
  'module',
  'property',
  'unit',
  'value',
  'enum',
  'keyword',
  'snippet',
  'color',
  'file',
  'reference',
  'folder',
  'enumMember',
  'constant',
  'struct',
  'event',
  'operator',
  'typeParameter',
];

const kindToLabel = (kind: SymbolKind) => {
  const config = workspace.getConfiguration('suggest.completionItemKindLabels') as { [key: string]: string };

  return config[kindOrder[kind]];
};

const comparePosition = (position: Position, other: Position): number => {
  if (position.line > other.line) return 1;
  if (other.line === position.line && position.character > other.character) return 1;
  if (other.line === position.line && position.character === other.character) return 0;

  return -1;
};

const positionInRange = (position: Position, range: Range): number => {
  const { start, end } = range;
  if (comparePosition(position, start) < 0) return -1;
  if (comparePosition(position, end) > 0) return 1;

  return 0;
};

const expandChildren = (symbol: DocumentSymbol): Array<DocumentSymbol> => {
  const children = symbol.children ?? [];

  return children.reduce(
    (acc, child) => {
      if (!Number.isNaN(parseInt(child.name, 10))) return acc;

      return [...acc, ...expandChildren(child)];
    },
    [symbol]
  );
};

export const nav = async (): Promise<void> => {
  const { document, position } = await workspace.getCurrentState();
  const tokenSource = new CancellationTokenSource();

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { provider }: { provider: DocumentSymbolProvider } = Array.from(languages.documentSymbolManager.providers)[0];

  const symbols = (
    (await provider.provideDocumentSymbols(document, tokenSource.token)) as ReadonlyArray<DocumentSymbol>
  )
    .map((v) => expandChildren(v))
    .flat();

  let arr: ReadonlyArray<{ name: string; kind: SymbolKind; label: string }> = [];
  for (const sym of symbols) {
    if (positionInRange(position, sym.range) === 0) {
      arr = [...arr, { name: sym.name, kind: sym.kind, label: kindToLabel(sym.kind) }];
    }
  }

  const bufnr = (await workspace.nvim.call('bufnr', ['%'])) as number;
  const buffer = workspace.nvim.createBuffer(bufnr);
  buffer.setVar(
    'coc_nav',
    arr.map(({ name, kind, label }) => ({
      name,
      label,
      highlight: `CocSymbol${kindOrder[kind].charAt(0).toUpperCase()}${kindOrder[kind].slice(1)}`,
    }))
  );
};
