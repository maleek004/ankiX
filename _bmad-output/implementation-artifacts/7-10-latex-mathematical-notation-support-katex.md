# Story 7.10: LaTeX Mathematical Notation Support (KaTeX)

**Status:** Done  
**Epic:** Epic 7: Modernized UI/UX Design System, Mobile Responsiveness & Workspace  
**Requirement IDs:** FR42  

---

## 1. User Story

**As a** learner reviewing algorithmic, computer science, and mathematical flashcards,  
**I want** mathematical notation formatted with LaTeX to render clearly with formulas, superscripts, subscripts, and equations,  
**So that** I can study algorithms, Big-O notations, data structures, and scientific formulas with proper mathematical typography.

---

## 2. Acceptance Criteria & Ergonomic Standards

1. **Inline & Block Math Processing:**
   - Expressions enclosed in single dollar signs (`$formula$`) render as crisp inline math.
   - Expressions enclosed in double dollar signs (`$$formula$$`) render as centered block display equations.
   - Integrate `remark-math` and `rehype-katex` into `MarkdownViewer.jsx` alongside existing `remark-gfm` and `rehype-highlight` plugins.
   - The plugin order must be strictly preserved:
     - `remarkPlugins={[remarkGfm, remarkMath]}`
     - `rehypePlugins={[rehypeHighlight, rehypeKatex]}`

2. **Visual Typography & KaTeX CSS / Font Assets:**
   - Import `katex/dist/katex.min.css` so that standard mathematical fonts, fractions, square roots, integrals, matrices, and summations render cleanly in both dark and light modes.
   - KaTeX font assets (`.woff2`, `.woff`, `.ttf`) must resolve cleanly through Vite asset bundling without 404s.

3. **Authoring Live Preview & Hint in MarkdownField:**
   - Update the default authoring hint in `MarkdownField.jsx` to explicitly mention math notation: `Supports Markdown & Math: **bold**, `code`, $inline$, $$block$$`.
   - Ensure the live preview pane (powered by `MarkdownViewer`) dynamically renders formulas as authors type in card creation, exercise authoring, and deck description editors.

4. **Mobile Equation Overflow Protection:**
   - Add `.katex-display` overflow handling (`overflow-x: auto`, `overflow-y: hidden`, `max-width: 100%`) in `styles.css`.
   - Large or multi-term equations must scroll horizontally on viewports `< 480px` rather than pushing out card boundaries or clipping.

5. **Code Block Dollar Sign Preservation:**
   - Verify that literal dollar signs inside code snippets (e.g. bash variables `$HOME`, jQuery `$('#id')`, or PHP `$var`) remain completely untouched and continue to be highlighted as code rather than KaTeX math.

---

## 3. Tasks & Subtasks

- [x] **Task 1: Package Dependencies Installation & Compatibility Verification**
  - [x] Install `remark-math`, `rehype-katex`, and `katex` in `src/frontend/package.json`.
  - [x] Verify version compatibility with `react-markdown: ^10.1.0` (unified 11 ecosystem: `remark-math@^6.0.0`, `rehype-katex@^7.0.1`, `katex@^0.18.5`).
  - [x] Verify Vite dev server and production build bundle font assets cleanly.

- [x] **Task 2: AST Integration in MarkdownViewer**
  - [x] Import `remarkMath` from `remark-math` and `rehypeKatex` from `rehype-katex` in `src/frontend/src/components/MarkdownViewer.jsx`.
  - [x] Add `remarkMath` to `remarkPlugins` array.
  - [x] Add `rehypeKatex` to `rehypePlugins` array.
  - [x] Import `katex/dist/katex.min.css` in `MarkdownViewer.jsx`.

- [x] **Task 3: Authoring Hint & MarkdownField Updates**
  - [x] Update default `hint` in `src/frontend/src/components/MarkdownField.jsx` to include `$inline$` and `$$block$$`.
  - [x] Validate live preview pane reactivity with `useDeferredValue`.

- [x] **Task 4: CSS Typography & Mobile Overflow Protection**
  - [x] Add KaTeX display equation styles in `src/frontend/src/styles.css`:
    ```css
    .markdown-content .katex {
      font-size: 1.05em;
    }
    .markdown-content .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 6px 0;
      margin: 12px 0;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
    }
    .markdown-content .katex-display::-webkit-scrollbar {
      height: 4px;
    }
    .markdown-content .katex-display::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.2);
      border-radius: 4px;
    }
    ```
  - [x] Ensure KaTeX text colors adapt properly to light/dark themes.

- [x] **Task 5: Automated Testing Suite & Regression Verification**
  - [x] Create `src/frontend/src/__tests__/MarkdownMath.test.jsx`.
  - [x] Test inline math rendering (`$O(n \log n)$`).
  - [x] Test display math block rendering (`$$\sum_{i=1}^n i$$`).
  - [x] Test code snippet preservation with literal dollar signs (`echo $USER` in backticks and fenced code blocks).
  - [x] Test `MarkdownField` live preview rendering of LaTeX formulas.
  - [x] Run full frontend test suite (`npm run test:ci` - 18 test files, 75 passed).
  - [x] Run full production build (`npm run build` - successful asset emission).

### Review Findings
- [x] [Review][Patch] Pass { throwOnError: false, strict: 'ignore' } to rehypeKatex for runtime fault tolerance [`src/frontend/src/components/MarkdownViewer.jsx:150`]
- [x] [Review][Patch] Prevent equation vertical clipping and add standards-compliant scrollbar-width/scrollbar-color [`src/frontend/src/styles.css:1041`]
- [x] [Review][Patch] Use String.raw for inline math test string fixture to test actual LaTeX escape sequence [`src/frontend/src/__tests__/MarkdownMath.test.jsx:11`]
- [x] [Review][Patch] Restore code block guidance and add dollar escaping hint to MarkdownField [`src/frontend/src/components/MarkdownField.jsx:11`]

---

## 4. Dev Notes & Architecture Guardrails

- **Unified AST Ecosystem:** `react-markdown` v10 uses unified 11 / mdast / hast. Used `remark-math@^6.0.0` and `rehype-katex@^7.0.1` alongside `katex@^0.18.5`.
- **Escape Rules:** Standard Markdown rules apply: literal dollar signs outside code blocks can be escaped as `\$` if authors do not want math parsing.
- **Pure Client Component:** Zero backend changes, zero database changes, zero API calls needed.

---

## 5. Test & Verification Plan

- **Automated Vitest Tests (`src/frontend/src/__tests__/MarkdownMath.test.jsx`):**
  - `renders inline math with katex span`: verifies `$O(n \log n)$` renders `<span class="katex">` (PASSED)
  - `renders display block equations with katex-display wrappers`: verifies `$$\sum_{i=1}^n i$$` renders `<span class="katex-display">` (PASSED)
  - `preserves literal dollar signs inside inline code without converting to math`: verifies `<code>$HOME</code>` is not converted to KaTeX (PASSED)
  - `preserves literal dollar signs inside fenced code blocks`: verifies bash variables like `$API_KEY` are highlighted as code (PASSED)
  - `renders math notation inside MarkdownField live preview`: verifies typing LaTeX in `MarkdownField` updates preview with KaTeX elements (PASSED)
  - `displays updated authoring hint with math support indicators in MarkdownField`: verifies hint text (PASSED)
- **Full Regression Verification:**
  - Run `npm run test:ci`: 18 test files passed, 75 tests passed (PASSED)
  - Run `npm run build`: Production build passes and assets bundle without errors (PASSED)
