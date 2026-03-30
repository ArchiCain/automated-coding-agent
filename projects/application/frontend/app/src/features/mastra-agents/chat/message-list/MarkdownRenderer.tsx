import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Link } from '@mui/material';
import { CodeBlock } from './CodeBlock';
import './markdown.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className
}) => {
  return (
    <Box
      className={className}
      sx={{
        maxWidth: 'none',
        '& > *:first-of-type': { mt: 0 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <Typography component="h1" variant="h5" fontWeight="bold" sx={{ mb: 1, mt: 2 }}>
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography component="h2" variant="h6" fontWeight="bold" sx={{ mb: 1, mt: 1.5 }}>
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography component="h3" variant="subtitle1" fontWeight="600" sx={{ mb: 0.5, mt: 1 }}>
              {children}
            </Typography>
          ),
          // Customize paragraph spacing
          p: ({ children }) => (
            <Typography variant="body2" sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
              {children}
            </Typography>
          ),
          // Customize list styles
          ul: ({ children }) => (
            <Box component="ul" sx={{ listStyleType: 'disc', pl: 3, mb: 1, '& li': { mb: 0.5 } }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ listStyleType: 'decimal', pl: 3, mb: 1, '& li': { mb: 0.5 } }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Box component="li" sx={{ ml: 0 }}>
              <Typography variant="body2" component="span">
                {children}
              </Typography>
            </Box>
          ),
          // Customize code blocks
          code: ({ children, className }) => {
            const isInline = !className;
            console.log('Code element - inline:', isInline, 'className:', className, 'children:', String(children).substring(0, 50));

            if (isInline) {
              return (
                <CodeBlock
                  className={className || ''}
                  inline={true}
                >
                  {String(children)}
                </CodeBlock>
              );
            }

            // This is a code block
            return (
              <CodeBlock
                className={className || ''}
                inline={false}
              >
                {String(children)}
              </CodeBlock>
            );
          },
          // Customize blockquotes
          blockquote: ({ children }) => (
            <Box
              component="blockquote"
              sx={{
                pl: 1.5,
                fontStyle: 'italic',
                mb: 1,
                borderLeft: '4px solid',
                borderColor: 'grey.700',
                color: 'text.secondary',
              }}
            >
              {children}
            </Box>
          ),
          // Customize tables
          table: ({ children }) => (
            <Box sx={{ overflowX: 'auto', mb: 1 }}>
              <Box
                component="table"
                sx={{
                  minWidth: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.75rem',
                  border: 1,
                  borderColor: 'grey.700',
                }}
              >
                {children}
              </Box>
            </Box>
          ),
          thead: ({ children }) => (
            <Box component="thead" sx={{ bgcolor: 'grey.800' }}>
              {children}
            </Box>
          ),
          th: ({ children }) => (
            <Box
              component="th"
              sx={{
                px: 1,
                py: 0.5,
                textAlign: 'left',
                fontWeight: 600,
                border: 1,
                borderColor: 'grey.700',
                color: 'grey.50',
              }}
            >
              {children}
            </Box>
          ),
          td: ({ children }) => (
            <Box
              component="td"
              sx={{
                px: 1,
                py: 0.5,
                border: 1,
                borderColor: 'grey.700',
                color: 'grey.200',
              }}
            >
              {children}
            </Box>
          ),
          // Customize links
          a: ({ children, href }) => (
            <Link
              href={href}
              sx={{
                color: 'grey.500',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </Link>
          ),
          // Customize horizontal rules
          hr: () => (
            <Box
              component="hr"
              sx={{
                my: 1.5,
                borderColor: 'grey.700',
              }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};
