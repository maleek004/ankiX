import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import MarkdownViewer from '../components/MarkdownViewer'
import MarkdownField from '../components/MarkdownField'

describe('Markdown LaTeX Mathematical Notation (Story 7.10)', () => {
  it('renders inline math expressions with KaTeX spans', () => {
    const { container } = render(
      <MarkdownViewer content={String.raw`The algorithm runs in $O(n \log n)$ time.`} />
    )
    
    // KaTeX outputs an element with class "katex"
    const katexElement = container.querySelector('.katex')
    expect(katexElement).toBeInTheDocument()
    expect(container.textContent).toContain('O(n')
  })

  it('renders display block equations with katex-display wrappers', () => {
    const mathContent = String.raw`
Here is Gauss's formula:

$$
\sum_{i=1}^n i = \frac{n(n+1)}{2}
$$

And text after equation.
`
    const { container } = render(<MarkdownViewer content={mathContent} />)
    
    const displayElement = container.querySelector('.katex-display')
    expect(displayElement).toBeInTheDocument()
    expect(displayElement.querySelector('.katex')).toBeInTheDocument()
  })

  it('preserves literal dollar signs inside inline code without converting to math', () => {
    const { container } = render(
      <MarkdownViewer content="Run `echo $HOME` or inspect `$variable`." />
    )
    
    const codeElements = container.querySelectorAll('code')
    expect(codeElements.length).toBeGreaterThan(0)
    expect(container.textContent).toContain('echo $HOME')
    expect(container.textContent).toContain('$variable')
    
    // There should be no KaTeX math elements rendered for inline code
    const katexElement = container.querySelector('.katex')
    expect(katexElement).toBeNull()
  })

  it('preserves literal dollar signs inside fenced code blocks', () => {
    const codeBlockContent = `\`\`\`bash
export API_KEY="secret"
echo $API_KEY
\`\`\``
    const { container } = render(<MarkdownViewer content={codeBlockContent} />)
    
    expect(container.textContent).toContain('echo $API_KEY')
    const katexElement = container.querySelector('.katex')
    expect(katexElement).toBeNull()
  })

  it('renders math notation inside MarkdownField live preview', () => {
    const { container } = render(
      <MarkdownField
        label="Card Prompt"
        value="Solve for $x$: $x^2 - 4 = 0$"
        onChange={() => {}}
      />
    )
    
    expect(screen.getByText('👁️ Live Markdown Preview')).toBeInTheDocument()
    const katexElements = container.querySelectorAll('.katex')
    expect(katexElements.length).toBeGreaterThan(0)
  })

  it('displays updated authoring hint with math support indicators in MarkdownField', () => {
    render(
      <MarkdownField
        label="Math Card Prompt"
        value=""
        onChange={() => {}}
      />
    )
    
    expect(
      screen.getByText(/Supports Markdown & Math: \*\*bold\*\*, `code`, ```code blocks, \$inline\$, \$\$block\$\$ \(escape with \\\$\)/)
    ).toBeInTheDocument()
  })

  it('gracefully handles invalid LaTeX syntax without crashing React render cycle', () => {
    const { container } = render(
      <MarkdownViewer content={String.raw`Broken formula: $\frac{incomplete$`} />
    )
    expect(container).toBeInTheDocument()
    expect(container.textContent).toContain('Broken formula:')
  })
})
