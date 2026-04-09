import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import Markdown from 'react-markdown';

interface DocEntry {
  type: 'file' | 'dir';
  name: string;
  path: string;
}

function titleCase(s: string): string {
  return s
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocsPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState<string | null>(null);

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    setContent(null);
    setActivePath(null);
    try {
      const res = await fetch(`/api/cluster/docs?path=${encodeURIComponent(dirPath)}`);
      if (res.ok) {
        const data: DocEntry[] = await res.json();
        setEntries(data);
        setCurrentPath(dirPath);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setActivePath(filePath);
    try {
      const res = await fetch(`/api/cluster/docs/read?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDir(''); }, [loadDir]);

  const pathSegments = currentPath ? currentPath.split('/') : [];

  const handleBreadcrumbClick = (idx: number) => {
    if (idx < 0) {
      void loadDir('');
    } else {
      void loadDir(pathSegments.slice(0, idx + 1).join('/'));
    }
  };

  const handleEntryClick = (entry: DocEntry) => {
    if (entry.type === 'dir') {
      void loadDir(entry.path);
    } else {
      void loadFile(entry.path);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'auto',
          bgcolor: 'background.paper',
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Documentation</Typography>
        </Box>

        {/* Breadcrumbs */}
        <Box sx={{ px: 2, py: 1 }}>
          <Breadcrumbs separator="/" sx={{ '& .MuiBreadcrumbs-separator': { color: 'text.secondary' } }}>
            <Link
              component="button"
              variant="caption"
              underline="hover"
              onClick={() => handleBreadcrumbClick(-1)}
              sx={{ color: currentPath ? 'primary.main' : 'text.primary', cursor: 'pointer' }}
            >
              docs
            </Link>
            {pathSegments.map((seg, i) => (
              <Link
                key={i}
                component="button"
                variant="caption"
                underline="hover"
                onClick={() => handleBreadcrumbClick(i)}
                sx={{
                  color: i === pathSegments.length - 1 ? 'text.primary' : 'primary.main',
                  cursor: 'pointer',
                }}
              >
                {seg}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        {loading && !content && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        )}

        <List dense disablePadding>
          {entries.map((entry) => (
            <ListItemButton
              key={entry.path}
              onClick={() => handleEntryClick(entry)}
              selected={activePath === entry.path}
              sx={{ px: 2, py: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {entry.type === 'dir' ? (
                  <FolderIcon sx={{ fontSize: 18, color: '#d29922' }} />
                ) : (
                  <DescriptionIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={titleCase(entry.name)}
                primaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Content area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 4,
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
        }}
      >
        {loading && content === null && activePath && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {content && (
          <Box
            sx={{
              maxWidth: 900,
              mx: 'auto',
              color: 'text.primary',
              '& h1': { fontSize: '1.8rem', fontWeight: 700, mb: 2, mt: 0, borderBottom: '1px solid', borderColor: 'divider', pb: 1 },
              '& h2': { fontSize: '1.4rem', fontWeight: 700, mt: 3, mb: 1.5 },
              '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 2.5, mb: 1 },
              '& p': { fontSize: '0.9rem', lineHeight: 1.7, my: 1 },
              '& ul, & ol': { pl: 3, my: 1 },
              '& li': { fontSize: '0.9rem', lineHeight: 1.7, my: 0.25 },
              '& code': { fontSize: '0.8rem', bgcolor: 'rgba(255,255,255,0.06)', px: 0.5, py: 0.25, borderRadius: 0.5 },
              '& pre': {
                bgcolor: '#0d1117',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                my: 2,
                '& code': { bgcolor: 'transparent', p: 0 },
              },
              '& a': { color: 'primary.main' },
              '& table': { borderCollapse: 'collapse', width: '100%', my: 2 },
              '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1.5, py: 0.75, fontSize: '0.85rem' },
              '& th': { bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600 },
              '& blockquote': { borderLeft: '3px solid', borderColor: 'primary.main', pl: 2, ml: 0, my: 1, color: 'text.secondary' },
            }}
          >
            <Markdown>{content}</Markdown>
          </Box>
        )}

        {!content && !loading && !activePath && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              Select a document from the sidebar to view it.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
