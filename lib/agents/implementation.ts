import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { z } from 'zod'

// Implementation Agent - Generates code and creates PRs
export const implementationAgent = new ToolLoopAgent({
  model: 'openai/gpt-5',
  instructions: `You are an expert implementation agent specializing in Next.js and React development. Your role is to implement SEO improvements by generating code and creating pull requests.

Your capabilities:
- Generate optimized React/Next.js components
- Create or modify metadata configurations
- Implement schema.org structured data
- Optimize image components with next/image
- Create SEO-friendly layouts and pages

Code quality standards:
- Follow Next.js 15+ best practices
- Use TypeScript with proper typing
- Implement accessible, semantic HTML
- Use Tailwind CSS for styling
- Follow the existing codebase conventions

When implementing:
- Generate complete, working code
- Include proper imports
- Add appropriate comments
- Ensure the code is production-ready`,

  tools: {
    generateMetadata: tool({
      description: 'Generate Next.js metadata configuration for a page',
      inputSchema: z.object({
        pageTitle: z.string(),
        pageDescription: z.string(),
        pagePath: z.string(),
        keywords: z.array(z.string()).optional(),
        ogImageUrl: z.string().optional(),
      }),
      execute: async ({ pageTitle, pageDescription, pagePath, keywords, ogImageUrl }) => {
        const metadata = `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${pageTitle}',
  description: '${pageDescription}',
  ${keywords ? `keywords: ${JSON.stringify(keywords)},` : ''}
  openGraph: {
    title: '${pageTitle}',
    description: '${pageDescription}',
    url: '${pagePath}',
    siteName: 'Your Site Name',
    ${ogImageUrl ? `images: ['${ogImageUrl}'],` : ''}
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '${pageTitle}',
    description: '${pageDescription}',
    ${ogImageUrl ? `images: ['${ogImageUrl}'],` : ''}
  },
}`
        return { code: metadata, type: 'metadata' }
      },
    }),

    generateSchemaMarkup: tool({
      description: 'Generate JSON-LD schema.org structured data',
      inputSchema: z.object({
        schemaType: z.enum(['Organization', 'WebSite', 'Article', 'Product', 'FAQPage', 'BreadcrumbList']),
        data: z.record(z.any()),
      }),
      execute: async ({ schemaType, data }) => {
        const schema = {
          '@context': 'https://schema.org',
          '@type': schemaType,
          ...data,
        }

        const component = `export function ${schemaType}Schema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(${JSON.stringify(schema, null, 2)})
      }}
    />
  )
}`
        return { code: component, schema, type: 'structured_data' }
      },
    }),

    generateSEOComponent: tool({
      description: 'Generate a reusable SEO component',
      inputSchema: z.object({
        componentName: z.string(),
        componentType: z.enum(['heading', 'breadcrumb', 'image', 'link', 'section']),
        requirements: z.string(),
      }),
      execute: async ({ componentName, componentType, requirements }) => {
        let code = ''

        if (componentType === 'heading') {
          code = `interface ${componentName}Props {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
  className?: string
}

export function ${componentName}({ level = 2, children, className }: ${componentName}Props) {
  const Tag = \`h\${level}\` as keyof JSX.IntrinsicElements
  
  return (
    <Tag className={className}>
      {children}
    </Tag>
  )
}`
        } else if (componentType === 'breadcrumb') {
          code = `interface BreadcrumbItem {
  label: string
  href?: string
}

interface ${componentName}Props {
  items: BreadcrumbItem[]
}

export function ${componentName}({ items }: ${componentName}Props) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          {item.href ? (
            <a href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </a>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}`
        } else if (componentType === 'image') {
          code = `import Image from 'next/image'

interface ${componentName}Props {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  className?: string
}

export function ${componentName}({ src, alt, width, height, priority, className }: ${componentName}Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      loading={priority ? undefined : 'lazy'}
    />
  )
}`
        }

        return { code, componentName, componentType, requirements }
      },
    }),

    optimizeExistingCode: tool({
      description: 'Optimize existing code for better SEO',
      inputSchema: z.object({
        originalCode: z.string(),
        optimizationType: z.enum(['metadata', 'images', 'headings', 'accessibility', 'performance']),
        instructions: z.string(),
      }),
      execute: async ({ originalCode, optimizationType, instructions }) => {
        // This tool provides context - the actual optimization is done by the LLM
        return {
          originalCode,
          optimizationType,
          instructions,
          message: 'Analyze the original code and apply the optimization based on the instructions.',
        }
      },
    }),

    prepareGitCommit: tool({
      description: 'Prepare files for a Git commit',
      inputSchema: z.object({
        files: z.array(z.object({
          path: z.string(),
          content: z.string(),
          action: z.enum(['create', 'update', 'delete']),
        })),
        commitMessage: z.string(),
        branchName: z.string(),
      }),
      execute: async ({ files, commitMessage, branchName }) => {
        return {
          files,
          commitMessage,
          branchName,
          status: 'ready_to_commit',
          summary: `${files.length} file(s) prepared for commit on branch ${branchName}`,
        }
      },
    }),

    requestV0Generation: tool({
      description: 'Request v0 MCP to generate a component based on requirements',
      inputSchema: z.object({
        prompt: z.string().describe('The component generation prompt for v0'),
        context: z.string().optional().describe('Additional context about the project'),
      }),
      execute: async ({ prompt, context }) => {
        // This creates a request that will be handled by the v0 MCP integration
        return {
          prompt,
          context,
          status: 'pending_v0_generation',
          message: 'Component generation request prepared for v0 MCP',
        }
      },
    }),
  },

  stopWhen: stepCountIs(12),

  callOptionsSchema: z.object({
    proposalId: z.string(),
    repositoryId: z.string(),
    userId: z.string(),
  }),

  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: settings.instructions + `
    
Implementation context:
- Proposal ID: ${options.proposalId}
- Repository ID: ${options.repositoryId}
- Generate production-ready code that can be directly committed.`,
  }),
})

export type ImplementationAgent = typeof implementationAgent
