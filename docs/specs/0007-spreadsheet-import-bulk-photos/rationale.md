# 0007. Spreadsheet import and bulk photos: rationale

Decision record for [index.md](index.md). Builds skip this file.

## Context

The owner has hundreds of products to load before launch, and typing each into the product editor (spec 0006) takes several minutes. The scope settles the shape: one spreadsheet template uploaded once, then photos in bulk, matched by product code in the file name. Its "Done when" adds that bad rows are listed without breaking the rest. Design open item O-22 left the columns, and what an existing code does, to the owner.

Forces that shaped the design:
- **The editor's save rules are subtle.** Spec 0006 reconciles sizes, colours, and pairs against stored rows, archives pairs that orders point at, keeps one default variant, and bumps `products.version`. It requires the import to keep all of this. A second writer for the same tables would have to repeat every rule and would drift.
- **The runtime.** Production runs on Cloudflare Workers, where CPU time per request is limited and every library in the server bundle adds to the cold start. A sheet parser is a large dependency.
- **Volume.** At most about 500 products and 1,000 photos per run, a few times a year, plus bulk price updates. Big enough that one request cannot do it all, small enough that it does not need a queue.
- **Who uses it.** The owner, often on a phone, fills an Arabic sheet in Excel or Google Sheets. Arabic text in CSV files exported from Excel often comes out in the wrong encoding.
- **Photos must be resized in the browser** (spec 0006 AC-8) to keep uploads fast and storage small, so the browser must handle photo files whatever else happens.

## Options considered

### Option 1: Read in the browser, save each product through the editor's save code (chosen)

The browser parses the sheet and photo names and shows the review. The server receives typed rows, rebuilds each product's full editor payload by merging with the stored product, and calls `saveProductInDb`, one transaction per product, in batches of 25.

**Pros**:
- One write path, so the import inherits every spec 0006 invariant and its tests.
- No parser in the Worker; the server only validates small JSON batches.
- Per product transactions give the "good rows import, bad rows listed" behaviour for free.

**Cons**:
- Slower than bulk SQL (about 20 queries per product), so a full catalog takes a minute or two.
- The page must stay open for the whole run.

### Option 2: Upload the file, parse and bulk write on the server

A Server Action receives the file, parses it in the Worker, and writes all products with set based `insert … on conflict` statements.

**Pros**:
- The fastest database work, a few statements for the whole sheet.
- The parsing logic lives in one place.

**Cons**:
- Duplicates `planVariants` as SQL, the exact drift spec 0006 warns about.
- A large `.xlsx` risks the Worker CPU limit, and the parser joins the server bundle.
- One big transaction is all or nothing, against the scope's "without breaking the rest".

### Option 3: Background job over a queue

The file goes to Storage, a Cloudflare Queue consumer or Workflow processes it, and the page polls a stored import status.

**Pros**:
- Handles any size, and the page can close during the run.
- A stored history of imports.

**Cons**:
- New infrastructure (a queue or workflow binding, a status table, polling) for a job that runs a few times a year at a size one page handles.
- Photos still need the browser for resizing, so the page cannot close anyway.

### Option 4: One all or nothing import

The browser reads the sheet, confirm is disabled until every row is clean (the design board's rule), and the server writes everything in one transaction.

**Pros**:
- Simplest to reason about: the catalog never holds part of a sheet.

**Cons**:
- One typo blocks 499 good products, which the owner chose against.
- One transaction for 500 products holds locks for a long time and risks a timeout.

## Rationale

Option 1 is the only one that keeps a single write path for products. That is the force that matters most: spec 0006's variant rules protect order history, and a second implementation would sooner or later break it. The cost is speed, and at about 500 products a few times a year, a minute or two of batches is acceptable. Reading in the browser follows from the Worker's limits and from the fact that photo resizing already has to happen there. Option 3 solves a scale the shop does not have. Option 4's strictness conflicts with the owner's answer and the scope.

Smaller calls made in this design:
- **One row per size**, chosen by the owner, over one row per product (packed cells are easy to mistype) and one row per pair (a 4 × 4 product is 16 rows).
- **Update on an existing code**, chosen by the owner, so the sheet doubles as a price update tool. Empty cells keep stored text, but sizes, prices, and colours follow the sheet exactly, because they define the variants and a partial option list has no clear meaning.
- **Required headers are الكود, الحجم, السعر, الألوان.** If الحجم or الألوان could be left out, a price only sheet would silently turn sized products simple, or remove their colours. Requiring the header (with cells allowed empty) makes the intent explicit. Runner up: treat an absent column as "keep", which leaves no way to tell which size a price belongs to.
- **Rows grouped by code anywhere in the sheet**, with later rows required to agree, over requiring adjacent rows. Sorting the sheet should never break an import.
- **New products hidden unless ظاهر says نعم**, so nothing goes live without its photos.
- **`read-excel-file` with `papaparse`**, chosen by the owner over SheetJS (large, and its current builds are no longer published to npm) and ExcelJS (heavy in the browser). `write-excel-file`, from the same author, builds the template and the problems file.
- **Template built in the browser**, chosen by the owner, so its القوائم sheet lists the current categories and colours. Examples sit on a second sheet because only the first sheet is read, so they can never be imported by accident.
- **Photo names `CODE_n`**, chosen by the owner, because a code can contain a hyphen but never an underscore.
- **Photos replace a product's set**, chosen by the owner, so a rerun never doubles photos. The video stays because the import has no way to name one.
- **Categories found or created per product in a short transaction before the save**, over threading category creation into `saveProductInDb`'s transaction. It keeps the 0006 save code unchanged apart from moving `findOrCreateTopCategory` into a shared module, at the cost of a rare empty category when a later save fails. Runner up: extend `saveProductInDb` to accept category names.
- **No import log table**, chosen by the owner. The downloadable problems file covers the need to keep a record.
- **Batches of 25, sent one after another**, over parallel batches, so category and colour creation never race against each other and the progress line stays simple.
- **One retry on `stale`**, so an import does not fail just because the owner saved the same product in another tab a moment before.

## Agent Skills

The owner declined an Agent Skill and MCP search for `read-excel-file`, `write-excel-file`, and `papaparse` (small libraries, unlikely to have one). `/sync` records the decline in `AGENTS.md`.
