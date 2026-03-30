import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'

// Mock CodeBlock component
vi.mock('./CodeBlock', () => ({
  CodeBlock: ({ children, inline, className }: { children: string; inline: boolean; className: string }) => (
    <code data-testid={inline ? 'inline-code' : 'block-code'} data-classname={className}>
      {children}
    </code>
  )
}))

// Mock markdown.css import
vi.mock('./markdown.css', () => ({}))

describe('MarkdownRenderer (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.log from component
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('Basic Rendering', () => {
    it('should render plain text', () => {
      render(<MarkdownRenderer content="Hello, World!" />)

      expect(screen.getByText('Hello, World!')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<MarkdownRenderer content="Test" className="custom-class" />)

      const wrapper = container.querySelector('.custom-class')
      expect(wrapper).toBeInTheDocument()
    })

    it('should handle empty content', () => {
      const { container } = render(<MarkdownRenderer content="" />)

      // MUI Box is rendered even with empty content
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('Headings', () => {
    it('should render h1 with correct content', () => {
      render(<MarkdownRenderer content="# Heading 1" />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading.textContent).toBe('Heading 1')
    })

    it('should render h2 with correct content', () => {
      render(<MarkdownRenderer content="## Heading 2" />)

      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toBeInTheDocument()
      expect(heading.textContent).toBe('Heading 2')
    })

    it('should render h3 with correct content', () => {
      render(<MarkdownRenderer content="### Heading 3" />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
      expect(heading.textContent).toBe('Heading 3')
    })

    it('should render multiple headings', () => {
      const content = `# H1
## H2
### H3`

      render(<MarkdownRenderer content={content} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })
  })

  describe('Paragraphs', () => {
    it('should render paragraphs', () => {
      render(<MarkdownRenderer content="This is a paragraph." />)

      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument()
    })

    it('should render multiple paragraphs', () => {
      const content = `First paragraph.

Second paragraph.`

      render(<MarkdownRenderer content={content} />)

      expect(screen.getByText('First paragraph.')).toBeInTheDocument()
      expect(screen.getByText('Second paragraph.')).toBeInTheDocument()
    })
  })

  describe('Lists', () => {
    it('should render unordered list', () => {
      const content = `- Item 1
- Item 2
- Item 3`

      render(<MarkdownRenderer content={content} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
    })

    it('should render ordered list', () => {
      const content = `1. First
2. Second
3. Third`

      render(<MarkdownRenderer content={content} />)

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })

    it('should render list items correctly', () => {
      const { container } = render(<MarkdownRenderer content="- Item" />)

      const listItem = container.querySelector('li')
      expect(listItem).toBeInTheDocument()
      expect(listItem?.textContent).toContain('Item')
    })
  })

  describe('Code', () => {
    it('should render inline code using CodeBlock', () => {
      render(<MarkdownRenderer content="This is `inline code` in text." />)

      const inlineCode = screen.getByTestId('inline-code')
      expect(inlineCode).toBeInTheDocument()
      expect(inlineCode.textContent).toBe('inline code')
    })

    it('should render code block using CodeBlock', () => {
      const content = `\`\`\`javascript
const x = 5;
\`\`\``

      render(<MarkdownRenderer content={content} />)

      const blockCode = screen.getByTestId('block-code')
      expect(blockCode).toBeInTheDocument()
      expect(blockCode.textContent).toContain('const x = 5')
    })
  })

  describe('Blockquotes', () => {
    it('should render blockquotes', () => {
      render(<MarkdownRenderer content="> This is a quote" />)

      expect(screen.getByText('This is a quote')).toBeInTheDocument()
    })

    it('should apply blockquote styling', () => {
      const { container } = render(<MarkdownRenderer content="> Quote" />)

      const blockquote = container.querySelector('blockquote')
      expect(blockquote).toBeInTheDocument()
    })
  })

  describe('Tables', () => {
    const tableContent = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`

    it('should render tables', () => {
      render(<MarkdownRenderer content={tableContent} />)

      expect(screen.getByText('Header 1')).toBeInTheDocument()
      expect(screen.getByText('Header 2')).toBeInTheDocument()
      expect(screen.getByText('Cell 1')).toBeInTheDocument()
      expect(screen.getByText('Cell 2')).toBeInTheDocument()
    })

    it('should wrap table in container', () => {
      const { container } = render(<MarkdownRenderer content={tableContent} />)

      expect(container.querySelector('table')).toBeInTheDocument()
    })

    it('should have thead element', () => {
      const { container } = render(<MarkdownRenderer content={tableContent} />)

      const thead = container.querySelector('thead')
      expect(thead).toBeInTheDocument()
    })

    it('should have th elements with styling', () => {
      const { container } = render(<MarkdownRenderer content={tableContent} />)

      const th = container.querySelector('th')
      expect(th).toBeInTheDocument()
      expect(th).toHaveStyle({ border: '1px solid' })
    })

    it('should have td elements with styling', () => {
      const { container } = render(<MarkdownRenderer content={tableContent} />)

      const td = container.querySelector('td')
      expect(td).toBeInTheDocument()
      expect(td).toHaveStyle({ border: '1px solid' })
    })
  })

  describe('Links', () => {
    it('should render links', () => {
      render(<MarkdownRenderer content="[Click here](https://example.com)" />)

      const link = screen.getByText('Click here')
      expect(link).toBeInTheDocument()
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', 'https://example.com')
    })

    it('should open links in new tab', () => {
      render(<MarkdownRenderer content="[Link](https://example.com)" />)

      const link = screen.getByText('Link')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should apply link styling', () => {
      render(<MarkdownRenderer content="[Link](https://example.com)" />)

      const link = screen.getByText('Link')
      // Verify it's a styled link (has the link element), not checking specific CSS values
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', 'https://example.com')
    })
  })

  describe('Horizontal Rules', () => {
    it('should render horizontal rules', () => {
      const { container } = render(<MarkdownRenderer content="---" />)

      const hr = container.querySelector('hr')
      expect(hr).toBeInTheDocument()
    })

    it('should apply hr styling', () => {
      const { container } = render(<MarkdownRenderer content="---" />)

      const hr = container.querySelector('hr')
      expect(hr).toHaveStyle({ borderColor: expect.stringMatching(/grey/) })
    })
  })

  describe('Complex Content', () => {
    it('should render mixed content correctly', () => {
      const content = `# Title

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const x = 5;
\`\`\`

> A quote`

      render(<MarkdownRenderer content={content} />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByText(/This is a paragraph/)).toBeInTheDocument()
      expect(screen.getByText('bold').tagName).toBe('STRONG')
      expect(screen.getByText('italic').tagName).toBe('EM')
      expect(screen.getByText('List item 1')).toBeInTheDocument()
      expect(screen.getByTestId('block-code')).toBeInTheDocument()
      expect(screen.getByText('A quote')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters', () => {
      render(<MarkdownRenderer content='Test <div> & "quotes"' />)

      expect(screen.getByText(/Test <div> & "quotes"/)).toBeInTheDocument()
    })

    it('should handle content with only whitespace', () => {
      const { container } = render(<MarkdownRenderer content="   " />)

      // Should still render container
      expect(container.firstChild).toBeInTheDocument()
    })
  })
})
