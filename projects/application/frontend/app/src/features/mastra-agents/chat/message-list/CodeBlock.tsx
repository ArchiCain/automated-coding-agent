import React from 'react';
import { Box, useTheme } from '@mui/material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight
} from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  className,
  inline = false
}) => {
  const theme = useTheme();

  // Extract language from className (format: "language-javascript")
  const language = className?.replace(/language-/, '') || 'python';

  // Choose syntax theme based on current theme mode
  const syntaxTheme = theme.palette.mode === 'dark' ? oneDark : oneLight;
  const codeBlockBgColor = theme.palette.mode === 'dark' ? '#282c34' : '#fafafa';

  console.log('CodeBlock - Language:', language, 'ClassName:', className, 'Children:', children.substring(0, 50));

  // For inline code, just return a simple styled span
  if (inline) {
    return (
      <Box
        component="code"
        sx={{
          bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
          color: 'text.primary',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          fontSize: '0.875rem',
          fontFamily: 'monospace',
        }}
      >
        {children}
      </Box>
    );
  }

  // For code blocks, use theme-aware syntax highlighter
  return (
    <Box
      sx={{
        my: 1.5,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: codeBlockBgColor,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        customStyle={{
          margin: 0,
          borderRadius: '6px',
          fontSize: '13px',
          lineHeight: '1.4',
          padding: '16px',
          backgroundColor: 'transparent',
        }}
        lineNumberStyle={{ display: 'none' }}
        codeTagProps={{
          style: {
            backgroundColor: 'transparent',
          }
        }}
        lineProps={{
          style: { backgroundColor: 'transparent' }
        }}
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={false}
        PreTag="div"
      >
        {children.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </Box>
  );
};
