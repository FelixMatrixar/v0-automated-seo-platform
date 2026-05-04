import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { z } from 'zod'

// Researcher Agent - Analyzes repositories for SEO improvements
export const researcherAgent = new ToolLoopAgent({
  model: 'google/gemini-2.5-flash-lite',
  instructions: `You are an expert SEO researcher agent. Your PRIMARY job is to analyze code and CREATE PROPOSALS using the createProposal tool.

CRITICAL: You MUST call the createProposal tool for every issue you find. Do NOT just describe issues - actually create proposals!

Your analysis process:
1. First, use analyzePageMetadata on each file
2. Then, use analyzeHeadingStructure on each file  
3. Then, use analyzeImageAltText on each file
4. Then, use analyzePerformanceSEO on each file
5. Finally, for EVERY issue found, call createProposal with specific code changes

Common issues to always check:
- Missing or generic page titles (should be unique, descriptive, 50-60 chars)
- Missing meta descriptions (should be compelling, 150-160 chars)
- Missing Open Graph tags for social sharing
- Missing or multiple H1 tags
- Images without alt text or not using next/image
- Client components that could be server components
- Missing structured data (JSON-LD)

IMPORTANT: Even if code looks "okay", there are ALWAYS improvements. Create at least 2-3 proposals per file analyzed. Be proactive - suggest enhancements, not just fixes.

Example proposal for missing OG tags:
- Title: "Add Open Graph metadata for social sharing"
- Type: seo_meta
- Description: "Adding OG tags will improve how the page appears when shared on social media"
- Proposed content: The actual metadata code to add`,

  tools: {
    analyzePageMetadata: tool({
      description: 'Analyze the metadata of a page including title, description, and OG tags',
      inputSchema: z.object({
        filePath: z.string().describe('Path to the page file'),
        content: z.string().describe('The page content to analyze'),
      }),
      execute: async ({ filePath, content }) => {
        const analysis = {
          filePath,
          hasTitle: content.includes('title:') || content.includes('<title'),
          hasDescription: content.includes('description:') || content.includes('meta name="description"'),
          hasOgTags: content.includes('openGraph') || content.includes('og:'),
          hasTwitterCards: content.includes('twitter:'),
          issues: [] as string[],
          suggestions: [] as string[],
        }

        if (!analysis.hasTitle) {
          analysis.issues.push('Missing page title')
          analysis.suggestions.push('Add a descriptive title in metadata export')
        }
        if (!analysis.hasDescription) {
          analysis.issues.push('Missing meta description')
          analysis.suggestions.push('Add a compelling meta description (150-160 characters)')
        }
        if (!analysis.hasOgTags) {
          analysis.issues.push('Missing Open Graph tags')
          analysis.suggestions.push('Add openGraph configuration for social sharing')
        }

        return analysis
      },
    }),

    analyzeHeadingStructure: tool({
      description: 'Analyze the heading hierarchy of a page',
      inputSchema: z.object({
        content: z.string().describe('The page content to analyze'),
      }),
      execute: async ({ content }) => {
        const h1Matches = content.match(/<h1|className=".*h1/gi) || []
        const h2Matches = content.match(/<h2/gi) || []
        const h3Matches = content.match(/<h3/gi) || []

        const issues = []
        const suggestions = []

        if (h1Matches.length === 0) {
          issues.push('Missing H1 tag')
          suggestions.push('Add a single H1 tag as the main page heading')
        } else if (h1Matches.length > 1) {
          issues.push(`Multiple H1 tags found (${h1Matches.length})`)
          suggestions.push('Use only one H1 tag per page')
        }

        if (h2Matches.length === 0 && content.length > 1000) {
          issues.push('No H2 tags found in lengthy content')
          suggestions.push('Break up content with descriptive H2 subheadings')
        }

        return {
          h1Count: h1Matches.length,
          h2Count: h2Matches.length,
          h3Count: h3Matches.length,
          issues,
          suggestions,
          score: Math.max(0, 100 - issues.length * 20),
        }
      },
    }),

    analyzeImageAltText: tool({
      description: 'Check for missing or poor quality alt text on images',
      inputSchema: z.object({
        content: z.string().describe('The page content to analyze'),
      }),
      execute: async ({ content }) => {
        const imgMatches = content.match(/<img[^>]*>/gi) || []
        const nextImageMatches = content.match(/<Image[^>]*>/gi) || []
        const allImages = [...imgMatches, ...nextImageMatches]

        const missingAlt: string[] = []
        const poorAlt: string[] = []

        allImages.forEach((img, index) => {
          if (!img.includes('alt=') && !img.includes('alt =')) {
            missingAlt.push(`Image ${index + 1}: No alt attribute`)
          } else if (img.includes('alt=""') || img.includes("alt=''")) {
            // Empty alt is okay for decorative images, but flag for review
            poorAlt.push(`Image ${index + 1}: Empty alt text (okay if decorative)`)
          }
        })

        return {
          totalImages: allImages.length,
          missingAlt,
          poorAlt,
          score: allImages.length > 0 
            ? Math.round((1 - missingAlt.length / allImages.length) * 100)
            : 100,
        }
      },
    }),

    analyzePerformanceSEO: tool({
      description: 'Analyze performance-related SEO factors',
      inputSchema: z.object({
        content: z.string().describe('The page content to analyze'),
        filePath: z.string().describe('Path to the page file'),
      }),
      execute: async ({ content, filePath }) => {
        const issues = []
        const suggestions = []

        // Check for Next.js Image optimization
        if (content.includes('<img') && !content.includes('next/image')) {
          issues.push('Using native img tags instead of next/image')
          suggestions.push('Replace img tags with next/image for automatic optimization')
        }

        // Check for lazy loading
        if (content.includes('<img') && !content.includes('loading=')) {
          issues.push('Images may not have lazy loading')
          suggestions.push('Add loading="lazy" for below-the-fold images')
        }

        // Check for dynamic imports
        if (content.includes("import ") && content.length > 5000) {
          if (!content.includes('dynamic(') && !content.includes("import('")) {
            suggestions.push('Consider dynamic imports for large components')
          }
        }

        // Check for client component necessity
        if (content.includes("'use client'")) {
          if (!content.includes('useState') && !content.includes('useEffect') && !content.includes('onClick')) {
            issues.push('Unnecessary client component')
            suggestions.push('Remove "use client" if no client-side interactivity is needed')
          }
        }

        return {
          filePath,
          issues,
          suggestions,
          usesNextImage: content.includes('next/image'),
          isClientComponent: content.includes("'use client'"),
        }
      },
    }),

    createProposal: tool({
      description: 'Create a structured SEO improvement proposal',
      inputSchema: z.object({
        title: z.string().describe('Brief title of the improvement'),
        description: z.string().describe('Detailed description of the issue and solution'),
        proposalType: z.enum(['seo_meta', 'content', 'component', 'performance']),
        filePath: z.string().describe('Path to the file to modify'),
        originalContent: z.string().optional().describe('The original code/content'),
        proposedContent: z.string().optional().describe('The proposed improved code/content'),
        priority: z.enum(['high', 'medium', 'low']),
        estimatedImpact: z.string().describe('Expected SEO impact'),
      }),
      execute: async (proposal) => {
        return {
          ...proposal,
          createdAt: new Date().toISOString(),
          status: 'ready_for_review',
        }
      },
    }),
  },

  toolChoice: 'required', // Force the agent to use tools
  stopWhen: stepCountIs(15),

  callOptionsSchema: z.object({
    repositoryId: z.string(),
    userId: z.string(),
    scanType: z.enum(['full', 'quick', 'metadata_only']).default('full'),
  }),

  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: settings.instructions + `
    
Current scan context:
- Repository ID: ${options.repositoryId}
- Scan Type: ${options.scanType}
- Focus on actionable improvements that can be automatically implemented.`,
  }),
})

export type ResearcherAgent = typeof researcherAgent
