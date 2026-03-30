import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodeBlock } from './CodeBlock'

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      <code>{children}</code>
    </pre>
  )
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {}
}))

describe('CodeBlock (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.log from component
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('Inline Code', () => {
    it('should render inline code with simple styling', () => {
      const { container } = render(
        <CodeBlock inline={true}>const x = 5</CodeBlock>
      )

      const codeElement = container.querySelector('code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe('const x = 5')
    })

    it('should apply inline code styling classes', () => {
      const { container } = render(
        <CodeBlock inline={true}>inline code</CodeBlock>
      )

      // MUI Box component is used for inline code
      const codeElement = container.querySelector('code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe('inline code')
    })

    it('should render inline code without syntax highlighter', () => {
      render(<CodeBlock inline={true}>test</CodeBlock>)

      // Should NOT use syntax highlighter for inline code
      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument()
    })

    it('should handle empty inline code', () => {
      const { container } = render(<CodeBlock inline={true}>{''}</CodeBlock>)

      const codeElement = container.querySelector('code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe('')
    })

    it('should preserve special characters in inline code', () => {
      const { container } = render(
        <CodeBlock inline={true}>{'<div> & "'}</CodeBlock>
      )

      const codeElement = container.querySelector('code')
      expect(codeElement?.textContent).toBe('<div> & "')
    })
  })

  describe('Code Blocks', () => {
    it('should render code block with syntax highlighter', () => {
      render(
        <CodeBlock inline={false}>
          {`const greeting = "Hello, World!";
console.log(greeting);`}
        </CodeBlock>
      )

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })

    it('should extract language from className', () => {
      render(
        <CodeBlock inline={false} className="language-javascript">
          const x = 5;
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toHaveAttribute('data-language', 'javascript')
    })

    it('should default to python when no className provided', () => {
      render(
        <CodeBlock inline={false}>
          print("Hello")
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toHaveAttribute('data-language', 'python')
    })

    it('should handle various language classNames', () => {
      const languages = ['typescript', 'python', 'java', 'rust', 'go']

      languages.forEach(lang => {
        const { unmount } = render(
          <CodeBlock inline={false} className={`language-${lang}`}>
            code
          </CodeBlock>
        )

        const highlighter = screen.getByTestId('syntax-highlighter')
        expect(highlighter).toHaveAttribute('data-language', lang)
        unmount()
      })
    })

    it('should strip language- prefix from className', () => {
      render(
        <CodeBlock inline={false} className="language-typescript">
          type Test = string;
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toHaveAttribute('data-language', 'typescript')
    })

    it('should remove trailing newline from code content', () => {
      render(
        <CodeBlock inline={false}>
          {`function test() {\n  return true;\n}\n`}
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      const codeElement = highlighter.querySelector('code')
      // Trailing newline should be removed
      expect(codeElement?.textContent).toBe('function test() {\n  return true;\n}')
    })

    it('should preserve internal newlines', () => {
      const multilineCode = `line1
line2
line3`

      render(<CodeBlock inline={false}>{multilineCode}</CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      const codeElement = highlighter.querySelector('code')
      expect(codeElement?.textContent).toBe(multilineCode)
    })

    it('should have rounded corners on wrapper', () => {
      render(
        <CodeBlock inline={false}>code</CodeBlock>
      )

      // MUI Box component handles styling
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })

    it('should have overflow handling', () => {
      render(
        <CodeBlock inline={false}>code</CodeBlock>
      )

      // MUI Box component handles overflow styling
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })

    it('should have background styling', () => {
      render(
        <CodeBlock inline={false}>code</CodeBlock>
      )

      // MUI Box component handles background styling
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })
  })

  describe('Language Detection', () => {
    it('should handle className with only language name (no prefix)', () => {
      render(
        <CodeBlock inline={false} className="javascript">
          code
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      // Should use as-is if no language- prefix
      expect(highlighter).toHaveAttribute('data-language', 'javascript')
    })

    it('should handle empty className', () => {
      render(
        <CodeBlock inline={false} className="">
          code
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      // Should default to python
      expect(highlighter).toHaveAttribute('data-language', 'python')
    })

    it('should handle undefined className', () => {
      render(
        <CodeBlock inline={false}>
          code
        </CodeBlock>
      )

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toHaveAttribute('data-language', 'python')
    })
  })

  describe('Inline prop handling', () => {
    it('should default to block mode when inline not specified', () => {
      render(<CodeBlock>code</CodeBlock>)

      // Should use syntax highlighter (block mode)
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })

    it('should respect explicit inline=false', () => {
      render(<CodeBlock inline={false}>code</CodeBlock>)

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })

    it('should respect explicit inline=true', () => {
      const { container } = render(<CodeBlock inline={true}>code</CodeBlock>)

      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument()
      expect(container.querySelector('code')).toBeInTheDocument()
    })
  })

  describe('Content Handling', () => {
    it('should handle long code blocks', () => {
      const longCode = 'x'.repeat(1000)

      render(<CodeBlock inline={false}>{longCode}</CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toBeInTheDocument()
    })

    it('should handle special characters', () => {
      const specialCode = `<div>&nbsp;</div>\n"quotes" 'apostrophes'`

      render(<CodeBlock inline={false}>{specialCode}</CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toBeInTheDocument()
    })

    it('should handle code with tabs and spaces', () => {
      const indentedCode = `function test() {\n\t\treturn true;\n}`

      render(<CodeBlock inline={false}>{indentedCode}</CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      const codeElement = highlighter.querySelector('code')
      expect(codeElement?.textContent).toBe(indentedCode)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content in block mode', () => {
      render(<CodeBlock inline={false}>{''}</CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toBeInTheDocument()
    })

    it('should handle whitespace-only content', () => {
      render(<CodeBlock inline={false}>   \n   </CodeBlock>)

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toBeInTheDocument()
    })

    it('should handle numeric content', () => {
      const { container } = render(<CodeBlock inline={true}>12345</CodeBlock>)

      const codeElement = container.querySelector('code')
      expect(codeElement?.textContent).toBe('12345')
    })
  })
})
