import {
  CancellationTokenSource,
  DocumentSymbol,
  DocumentSymbolProvider,
  ExtensionContext,
  languages,
  Position,
  Range,
  SymbolKind,
  workspace,
} from 'coc.nvim';

type DocumentSymbolProviders = ReadonlyArray<{
  provider: DocumentSymbolProvider;
}>;

export async function activate(context: ExtensionContext): Promise<void> {
  context.subscriptions.push(
    workspace.registerAutocmd({
      event: 'CursorMoved',
      callback: () => {
        nav();
      },
    })
  );
}

const kindOrder = [
  '',
  'file',
  'module',
  'namespace',
  'package',
  'class',
  'method',
  'property',
  'field',
  'constructor',
  'enum',
  'interface',
  'function',
  'variable',
  'constant',
  'string',
  'number',
  'boolean',
  'array',
  'object',
  'key',
  'null',
  'enumMember',
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
  const bufnr = (await workspace.nvim.call('bufnr', ['%'])) as number;
  const buffer = workspace.nvim.createBuffer(bufnr);
  const filetype = (await buffer.getOption('filetype')) as string;

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const providers: DocumentSymbolProviders = Array.from(languages.documentSymbolManager.providers).filter(
    (v) =>
      // @ts-expect-error
      v.selector.includes(filetype) || v.selector.flatMap((s) => s?.language).includes(filetype)
  );

  if (providers.length === 0) return;
  const provider = providers[0].provider;

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

  await buffer.setVar(
    'coc_nav',
    arr.map(({ name, kind, label }) => ({
      name,
      label,
      highlight: `CocSymbol${kindOrder[kind].charAt(0).toUpperCase()}${kindOrder[kind].slice(1)}`,
    }))
  );
  workspace.nvim.call('coc#util#do_autocmd', ['CocNavChanged']);
};
