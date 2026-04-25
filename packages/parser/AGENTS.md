# @datalog/parser

## Ownership

- This package owns Datalog syntax parsing, AST construction from text, document analysis, symbol collection, and parser-facing semantic helpers.
- It consumes `@datalog/ast` for shared language contracts rather than redefining AST shapes locally.

## Package shape

- Keep `src/index.ts` export-only.
- Keep raw text scanning and position math under `src/syntax/`.
- Keep text-to-AST conversion under `src/ast/`.
- Keep editor-usable document analysis seams under `src/analysis/` and shared result contracts under `src/contracts/`.
- Keep parser semantics such as reference-role classification and graph vocabulary under `src/semantics/`.
- Keep tests colocated as `*.test.ts` beside the parser seam they prove.

## What belongs here

- Parsing `.dl` source into Datalog AST/program structures.
- Line/offset/range helpers used by downstream editor and LSP packages.
- Predicate, reference, graph semantic, and document symbol analysis derived from parsed source.

## What does not belong here

- LSP protocol types, VS Code APIs, or language-client wiring.
- PostgreSQL SQL rendering or runtime execution.
- Migration file workflow commands.

## Verification

- `yarn workspace @datalog/parser lint`
- `yarn workspace @datalog/parser typecheck`
- `yarn workspace @datalog/parser build`
- `yarn workspace @datalog/parser test`
