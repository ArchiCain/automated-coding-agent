import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import Markdown from 'react-markdown';
import { DocsChatBubble } from './docs-chat-bubble';

// The docs root relative to REPO_ROOT — this is where the benchmark frontend docs live
const DOCS_ROOT = 'benchmarking/build-a-frontend/docs';

interface TreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  tokens: number;
  children?: TreeNode[];
}

interface TreeRoot {
  root: string;
  tokens: number;
  children: TreeNode[];
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function titleCase(s: string): string {
  return s
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Tree Node Component ──────────────────────────────────────────

function TreeItem({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'dir';
  const isActive = activePath === node.path;

  return (
    <>
      <Box
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onSelect(node.path);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: depth * 2 + 1,
          pr: 1,
          py: 0.4,
          cursor: 'pointer',
          bgcolor: isActive ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
          '&:hover': { bgcolor: isActive ? 'rgba(88, 166, 255, 0.12)' : 'rgba(255,255,255,0.04)' },
          borderLeft: isActive ? '2px solid #58a6ff' : '2px solid transparent',
        }}
      >
        {isDir ? (
          expanded ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
          )
        ) : (
          <Box sx={{ width: 20, mr: 0.5 }} />
        )}

        {isDir ? (
          <FolderIcon sx={{ fontSize: 16, color: '#d29922', mr: 0.75 }} />
        ) : (
          <DescriptionIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.75 }} />
        )}

        <Typography
          sx={{
            flex: 1,
            fontSize: '0.78rem',
            color: isActive ? '#58a6ff' : 'text.primary',
            fontWeight: isActive ? 600 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {titleCase(node.name)}
        </Typography>

        <Tooltip title={`~${node.tokens.toLocaleString()} tokens`} placement="right">
          <Chip
            label={formatTokens(node.tokens)}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontFamily: 'monospace',
              bgcolor: node.tokens > 5000 ? 'rgba(255, 167, 38, 0.15)' : 'rgba(255,255,255,0.06)',
              color: node.tokens > 5000 ? '#ffa726' : 'text.secondary',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Tooltip>
      </Box>

      {isDir && node.children && (
        <Collapse in={expanded} timeout="auto">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}

// ── Markdown styles ──────────────────────────────────────────────

const markdownSx = {
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
  '& input[type="checkbox"]': { mr: 0.5 },
};

// ── Main Page Component ──────────────────────────────────────────

export function DocsPage() {
  const [tree, setTree] = useState<TreeRoot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load the full tree on mount
  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cluster/project-docs/tree?root=${encodeURIComponent(DOCS_ROOT)}`);
      if (res.ok) {
        const data: TreeRoot = await res.json();
        setTree(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadTree(); }, [loadTree]);

  // Load file content
  const handleSelect = useCallback(async (filePath: string) => {
    setActivePath(filePath);
    setEditing(false);
    setContentLoading(true);
    try {
      const res = await fetch(
        `/api/cluster/project-docs/read?root=${encodeURIComponent(DOCS_ROOT)}&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || null);
      }
    } catch { /* ignore */ }
    finally { setContentLoading(false); }
  }, []);

  // Save edited content
  const handleSave = useCallback(async () => {
    if (!activePath) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cluster/project-docs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: DOCS_ROOT, path: activePath, content: editContent }),
      });
      if (res.ok) {
        setContent(editContent);
        setEditing(false);
        void loadTree(); // refresh token counts
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activePath, editContent, loadTree]);

  const startEditing = () => {
    setEditContent(content || '');
    setEditing(true);
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* ── Left: File tree ────────────────────────────────── */}
      <Box
        sx={{
          width: 300,
          minWidth: 300,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'auto',
          bgcolor: 'background.paper',
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Project Docs
            </Typography>
            {tree && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                {formatTokens(tree.tokens)} tokens total
              </Typography>
            )}
          </Box>
        </Box>

        {/* Tree */}
        <Box sx={{ flex: 1, overflow: 'auto', py: 0.5 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
            </Box>
          )}

          {tree?.children.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              onSelect={handleSelect}
            />
          ))}
        </Box>
      </Box>

      {/* ── Center: Content viewer/editor ─────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
        }}
      >
        {/* Toolbar */}
        {activePath && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(255,255,255,0.02)',
              gap: 1,
            }}
          >
            <Typography
              sx={{
                flex: 1,
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: 'text.secondary',
              }}
            >
              {activePath}
            </Typography>

            {content !== null && !editing && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={startEditing} sx={{ color: 'text.secondary' }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            {editing && (
              <>
                <Button
                  size="small"
                  startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
                  onClick={handleSave}
                  disabled={saving}
                  variant="contained"
                  sx={{ fontSize: '0.7rem', py: 0.25, textTransform: 'none' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <IconButton
                  size="small"
                  onClick={() => setEditing(false)}
                  sx={{ color: 'text.secondary' }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </>
            )}
          </Box>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: editing ? 0 : 4 }}>
          {contentLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!contentLoading && content !== null && !editing && (
            <Box sx={markdownSx}>
              <Markdown>{content}</Markdown>
            </Box>
          )}

          {editing && (
            <TextField
              inputRef={editorRef}
              multiline
              fullWidth
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              sx={{
                height: '100%',
                '& .MuiInputBase-root': {
                  height: '100%',
                  alignItems: 'flex-start',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  bgcolor: '#0d1117',
                  p: 2,
                  borderRadius: 0,
                },
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& textarea': { height: '100% !important' },
              }}
            />
          )}

          {!content && !contentLoading && !activePath && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 1 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                Select a document from the tree to view it.
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Token counts show approximate context usage per file and directory.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Floating chat bubble ─────────────────────────── */}
      <DocsChatBubble />
    </Box>
  );
}
