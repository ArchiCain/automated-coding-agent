import { useState, useCallback, useRef } from 'react';
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
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DescriptionIcon from '@mui/icons-material/Description';
import CodeIcon from '@mui/icons-material/Code';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocsChatBubble } from './docs-chat-bubble';
import { SyncChatBubble } from './sync-chat-bubble';

const PROJECTS = [
  { label: 'Frontend', root: 'projects/application/frontend/app' },
  { label: 'Backend', root: 'projects/application/backend' },
  { label: 'Keycloak', root: 'projects/application/keycloak' },
  { label: 'Database', root: 'projects/application/database' },
  { label: 'E2E Tests', root: 'projects/application/e2e' },
];

interface TreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  tokens?: number;
  isDoc?: boolean;
  isDocsDir?: boolean;
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

/**
 * Filter tree for docs-only view:
 * - Only show doc files (files inside .docs/ dirs)
 * - Hide .docs/ directory nodes themselves (promote children up)
 * - Collapse single-child directory chains into one node (e.g. src/app/features → "src/app/features")
 */
function filterDocsOnly(nodes: TreeNode[]): TreeNode[] {
  // Step 1: Filter to only doc-containing branches, flattening .docs/ dirs
  const filtered = nodes
    .flatMap((node) => {
      if (node.type === 'file') {
        return node.isDoc ? [node] : [];
      }
      // If this IS a .docs/ dir, promote its children directly (skip the .docs node)
      if (node.isDocsDir) {
        return node.children || [];
      }
      // Regular directory — recurse
      const filteredChildren = filterDocsOnly(node.children || []);
      if (filteredChildren.length === 0) return [];
      return [{ ...node, children: filteredChildren }];
    });

  // Step 2: Collapse single-child directory chains
  return filtered.map((node) => collapseSingleChildDirs(node));
}

/** Collapse chains of dirs with only one child dir into "a/b/c" nodes */
function collapseSingleChildDirs(node: TreeNode): TreeNode {
  if (node.type === 'file') return node;
  const children = node.children || [];
  if (
    children.length === 1 &&
    children[0].type === 'dir' &&
    !children[0].isDocsDir
  ) {
    // Merge: "src" + "app" → "src/app", then recurse
    const merged: TreeNode = {
      ...children[0],
      name: `${node.name}/${children[0].name}`,
      tokens: children[0].tokens,
    };
    return collapseSingleChildDirs(merged);
  }
  // Recurse into children
  return { ...node, children: children.map(collapseSingleChildDirs) };
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
  const [expanded, setExpanded] = useState(node.isDocsDir || depth < 1);
  const isDir = node.type === 'dir';
  const isActive = activePath === node.path;
  const isDocFile = node.isDoc;
  const isDocsDir = node.isDocsDir;

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
          pl: depth * 1.5 + 0.5,
          pr: 1,
          py: 0.3,
          cursor: 'pointer',
          bgcolor: isActive ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
          '&:hover': { bgcolor: isActive ? 'rgba(88, 166, 255, 0.12)' : 'rgba(255,255,255,0.04)' },
          borderLeft: isActive ? '2px solid #58a6ff' : '2px solid transparent',
        }}
      >
        {isDir ? (
          expanded ? (
            <ExpandMoreIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.25 }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.25 }} />
          )
        ) : (
          <Box sx={{ width: 16, mr: 0.25 }} />
        )}

        {isDocsDir ? (
          <FolderSpecialIcon sx={{ fontSize: 14, color: '#58a6ff', mr: 0.5 }} />
        ) : isDir ? (
          <FolderIcon sx={{ fontSize: 14, color: '#d29922', mr: 0.5 }} />
        ) : isDocFile ? (
          <DescriptionIcon sx={{ fontSize: 14, color: '#58a6ff', mr: 0.5 }} />
        ) : (
          <CodeIcon sx={{ fontSize: 14, color: '#8b949e', mr: 0.5 }} />
        )}

        <Typography
          sx={{
            flex: 1,
            fontSize: '0.72rem',
            color: isActive ? '#58a6ff' : isDocFile || isDocsDir ? '#c9d1d9' : '#8b949e',
            fontWeight: isActive ? 600 : isDocsDir ? 600 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.name}
        </Typography>

        {(node.tokens ?? 0) > 0 && (
          <Tooltip title={`~${(node.tokens ?? 0).toLocaleString()} tokens`} placement="right">
            <Chip
              label={formatTokens(node.tokens ?? 0)}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                fontFamily: 'monospace',
                bgcolor: 'rgba(88, 166, 255, 0.1)',
                color: '#58a6ff',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Tooltip>
        )}
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

// ── Project section in sidebar ───────────────────────────────────

function ProjectSection({
  label,
  root,
  activePath,
  onSelect,
  showCode,
}: {
  label: string;
  root: string;
  activePath: string | null;
  onSelect: (root: string, path: string) => void;
  showCode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tree, setTree] = useState<TreeRoot | null>(null);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (loaded.current) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cluster/project-tree?root=${encodeURIComponent(root)}`);
      if (res.ok) {
        const data: TreeRoot = await res.json();
        setTree(data);
        loaded.current = true;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [root]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void load();
  };

  return (
    <Box>
      <Box
        onClick={toggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.6,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {expanded ? (
          <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
        )}
        <Typography sx={{ flex: 1, fontSize: '0.8rem', fontWeight: 700, color: 'text.primary' }}>
          {label}
        </Typography>
        {tree && (
          <Chip
            label={formatTokens(tree.tokens)}
            size="small"
            sx={{
              height: 16,
              fontSize: '0.55rem',
              fontFamily: 'monospace',
              bgcolor: 'rgba(88, 166, 255, 0.1)',
              color: '#58a6ff',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        )}
      </Box>
      <Collapse in={expanded} timeout="auto">
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={16} />
          </Box>
        )}
        {(showCode ? tree?.children : filterDocsOnly(tree?.children || []))?.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={1}
            activePath={activePath}
            onSelect={(p) => onSelect(root, p)}
          />
        ))}
      </Collapse>
    </Box>
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
  const [showCode, setShowCode] = useState(false);
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const handleSelect = useCallback(async (root: string, filePath: string) => {
    setActiveRoot(root);
    setActivePath(filePath);
    setEditing(false);
    setContentLoading(true);
    try {
      const res = await fetch(
        `/api/cluster/project-file/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || null);
      }
    } catch { /* ignore */ }
    finally { setContentLoading(false); }
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeRoot || !activePath) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cluster/project-file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: activeRoot, path: activePath, content: editContent }),
      });
      if (res.ok) {
        setContent(editContent);
        setEditing(false);
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [activeRoot, activePath, editContent]);

  const startEditing = () => {
    setEditContent(content || '');
    setEditing(true);
  };

  // Derive the full path for the chat context
  const fullActivePath = activeRoot && activePath ? `${activeRoot}/${activePath}` : null;
  const isMarkdown = activePath?.endsWith('.md');

  // Derive feature path for sync agent (extract up to features/{name})
  const featurePath: string | null = (() => {
    if (!fullActivePath) return null;
    const match = fullActivePath.match(/(.*\/features\/[^/]+)/);
    return match?.[1] ?? null;
  })();

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* ── Left: Project tree ──────────────────────────────── */}
      <Box
        sx={{
          width: 320,
          minWidth: 320,
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
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Projects
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showCode}
                onChange={(e) => setShowCode(e.target.checked)}
                sx={{ '& .MuiSwitch-thumb': { width: 14, height: 14 }, '& .MuiSwitch-switchBase': { p: '3px' }, '& .MuiSwitch-track': { borderRadius: 7 } }}
              />
            }
            label={<Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Code</Typography>}
            sx={{ m: 0, gap: 0.25 }}
          />
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {PROJECTS.map((p) => (
            <ProjectSection
              key={p.root}
              label={p.label}
              root={p.root}
              activePath={activePath}
              onSelect={handleSelect}
              showCode={showCode}
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
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'text.secondary',
              }}
            >
              {activeRoot}/{activePath}
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

        <Box sx={{ flex: 1, overflow: 'auto', p: editing ? 0 : 4 }}>
          {contentLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!contentLoading && content !== null && !editing && isMarkdown && (
            <Box sx={markdownSx}>
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </Box>
          )}

          {!contentLoading && content !== null && !editing && !isMarkdown && (
            <Box
              component="pre"
              sx={{
                maxWidth: 900,
                mx: 'auto',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}
            >
              {content}
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
                Expand a project and select a file to view it.
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Blue folders are .docs/ — documentation co-located with code.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Floating chat bubbles ────────────────────────── */}
      <DocsChatBubble
        activePath={fullActivePath}
        onDocChanged={() => { if (activeRoot && activePath) handleSelect(activeRoot, activePath); }}
      />
      <SyncChatBubble
        featurePath={featurePath}
        onDocChanged={() => { if (activeRoot && activePath) handleSelect(activeRoot, activePath); }}
      />
    </Box>
  );
}
