<script setup lang="ts">
import { ref, computed, watch, h as vueH } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  data: unknown
  initialExpanded?: boolean
}>()

interface TreeNode {
  key: string
  value: unknown
  type: string
  expanded: boolean
  children?: TreeNode[]
}

const expandedKeys = ref<Set<string>>(new Set())

const tree = computed(() => buildTree(props.data, 'root'))

function buildTree(data: unknown, key: string, path: string = ''): TreeNode {
  const fullPath = path ? `${path}.${key}` : key
  const type = getType(data)
  
  const node: TreeNode = {
    key,
    value: data,
    type,
    expanded: props.initialExpanded || expandedKeys.value.has(fullPath),
  }

  if (type === 'object' && data !== null) {
    node.children = Object.entries(data as Record<string, unknown>).map(([k, v]) => 
      buildTree(v, k, fullPath)
    )
  } else if (type === 'array') {
    node.children = (data as unknown[]).map((v, i) => 
      buildTree(v, String(i), fullPath)
    )
  }

  return node
}

function getType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function toggleExpand(path: string) {
  if (expandedKeys.value.has(path)) {
    expandedKeys.value.delete(path)
  } else {
    expandedKeys.value.add(path)
  }
}

// Reset expanded state when data changes
watch(() => props.data, () => {
  if (!props.initialExpanded) {
    expandedKeys.value.clear()
  }
})
</script>

<template>
  <div class="font-mono text-sm">
    <TreeNodeComponent 
      :node="tree" 
      :path="'root'"
      :expanded-keys="expandedKeys"
      @toggle="toggleExpand"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, h, type PropType } from 'vue'

interface TreeNode {
  key: string
  value: unknown
  type: string
  expanded: boolean
  children?: TreeNode[]
}

const TreeNodeComponent = defineComponent({
  name: 'TreeNodeComponent',
  props: {
    node: {
      type: Object as PropType<TreeNode>,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    expandedKeys: {
      type: Object as PropType<Set<string>>,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const isExpanded = () => props.expandedKeys.has(props.path)
    
    // Check if node is a container type (object or array)
    const isContainer = () => props.node.type === 'object' || props.node.type === 'array'
    const hasChildren = () => props.node.children && props.node.children.length > 0

    function getValueClass(type: string): string {
      const classes: Record<string, string> = {
        string: 'text-[var(--color-secondary)]',
        number: 'text-[var(--color-warning)]',
        boolean: 'text-[var(--color-primary)]',
        null: 'text-[var(--color-text-dim)]',
        undefined: 'text-[var(--color-text-dim)]',
      }
      return classes[type] || 'text-[var(--color-text)]'
    }

    function formatValue(value: unknown, type: string): string {
      if (type === 'string') return `"${value}"`
      if (type === 'null') return 'null'
      if (type === 'undefined') return 'undefined'
      if (type === 'object') return '{}'
      if (type === 'array') return '[]'
      return String(value)
    }

    function getPreview(node: TreeNode): string {
      if (node.type === 'array') {
        const len = (node.value as unknown[]).length
        return len === 0 ? '[]' : `Array(${len})`
      }
      if (node.type === 'object' && node.value !== null) {
        const keys = Object.keys(node.value as object)
        if (keys.length === 0) return '{}'
        return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`
      }
      return ''
    }

    return () => {
      const indent = props.depth * 16

      // For primitive values (not objects or arrays)
      if (!isContainer()) {
        return h('div', {
          class: 'flex items-center py-0.5 hover:bg-[var(--color-bg-tertiary)] rounded px-1',
          style: { paddingLeft: `${indent}px` },
        }, [
          h('span', { class: 'text-[var(--color-text-dim)] mr-2' }, props.node.key === 'root' ? '' : `${props.node.key}:`),
          h('span', { class: getValueClass(props.node.type) }, formatValue(props.node.value, props.node.type)),
        ])
      }

      // For empty objects/arrays
      if (!hasChildren()) {
        return h('div', {
          class: 'flex items-center py-0.5 hover:bg-[var(--color-bg-tertiary)] rounded px-1',
          style: { paddingLeft: `${indent}px` },
        }, [
          h('span', { class: 'text-[var(--color-text-dim)] mr-2' }, props.node.key === 'root' ? '' : `${props.node.key}:`),
          h('span', { class: 'text-[var(--color-text-dim)]' }, props.node.type === 'array' ? '[]' : '{}'),
        ])
      }

      // Parent node with children
      const children = []

      // Header
      children.push(
        h('div', {
          class: 'flex items-center py-0.5 hover:bg-[var(--color-bg-tertiary)] rounded px-1 cursor-pointer select-none',
          style: { paddingLeft: `${indent}px` },
          onClick: () => emit('toggle', props.path),
        }, [
          h(isExpanded() ? ChevronDown : ChevronRight, { class: 'text-[var(--color-primary)] mr-1 w-4 h-4' }),
          h('span', { class: 'text-[var(--color-text-dim)] mr-2' }, props.node.key === 'root' ? '' : `${props.node.key}:`),
          h('span', { class: 'text-[var(--color-text-dim)] text-xs' }, getPreview(props.node)),
        ])
      )

      // Children
      if (isExpanded() && props.node.children) {
        for (let i = 0; i < props.node.children.length; i++) {
          const child = props.node.children[i]
          const childPath = `${props.path}.${child.key}`
          children.push(
            h(TreeNodeComponent, {
              key: childPath,
              node: child,
              path: childPath,
              expandedKeys: props.expandedKeys,
              depth: props.depth + 1,
              onToggle: (path: string) => emit('toggle', path),
            })
          )
        }
      }

      return h('div', children)
    }
  },
})
</script>
