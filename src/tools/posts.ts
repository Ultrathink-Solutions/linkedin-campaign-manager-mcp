import type { LinkedInClient } from '../client.js';
import {
  CreatePostInputSchema,
  ListPostsInputSchema,
  GetPostInputSchema,
  UpdatePostInputSchema,
  DeletePostInputSchema,
} from '../types.js';
import { formatPost, buildUrn } from '../utils/formatters.js';

/**
 * Create a new post on a LinkedIn organization/company page.
 * Requires w_organization_social scope.
 */
export async function createPost(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { organizationId, text, visibility, linkUrl, isDarkPost } = CreatePostInputSchema.parse(input);

  const authorUrn = buildUrn('organization', organizationId);

  const postEntity: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility,
    distribution: {
      feedDistribution: isDarkPost ? 'NONE' : 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  // Add article/link content if URL provided
  if (linkUrl !== undefined && linkUrl !== '') {
    postEntity.content = {
      article: {
        source: linkUrl,
        title: '', // LinkedIn will auto-populate from URL
      },
    };
  }

  const response = await client.create<Record<string, unknown>>('/posts', postEntity);

  // The response includes the created post ID
  const postId = response.id ?? response['x-restli-id'];

  return JSON.stringify(
    {
      success: true,
      message: isDarkPost
        ? 'Dark post created successfully (not visible on company page)'
        : 'Post published successfully to company page',
      postUrn: postId,
      author: authorUrn,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    },
    null,
    2
  );
}

/**
 * List posts from a LinkedIn organization/company page.
 * Requires r_organization_social scope.
 */
export async function listPosts(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { organizationId, count, start } = ListPostsInputSchema.parse(input);

  const authorUrn = buildUrn('organization', organizationId);

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/posts',
    'author',
    {
      author: authorUrn,
      count,
      start,
      sortBy: 'LAST_MODIFIED',
    }
  );

  const posts = response.elements.map(formatPost);

  return JSON.stringify(
    {
      posts,
      count: posts.length,
      organizationId,
      pagination: {
        start,
        requested: count,
      },
    },
    null,
    2
  );
}

/**
 * Get a specific post by its URN.
 */
export async function getPost(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { postUrn } = GetPostInputSchema.parse(input);

  // URL-encode the URN for the API call
  const encodedUrn = encodeURIComponent(postUrn);

  const response = await client.get<Record<string, unknown>>('/posts', encodedUrn);

  return JSON.stringify(formatPost(response), null, 2);
}

/**
 * Update a post's text content.
 * Only the author can update their posts.
 */
export async function updatePost(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { postUrn, text } = UpdatePostInputSchema.parse(input);

  if (text === undefined || text === '') {
    return JSON.stringify(
      {
        success: false,
        message: 'No updates provided. Please specify text to update.',
      },
      null,
      2
    );
  }

  const encodedUrn = encodeURIComponent(postUrn);

  await client.partialUpdate('/posts', encodedUrn, {
    commentary: text,
  });

  return JSON.stringify(
    {
      success: true,
      message: 'Post updated successfully',
      postUrn,
      updatedFields: { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') },
    },
    null,
    2
  );
}

/**
 * Delete a post.
 * Only the author can delete their posts.
 */
export async function deletePost(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { postUrn } = DeletePostInputSchema.parse(input);

  const encodedUrn = encodeURIComponent(postUrn);

  await client.delete('/posts', encodedUrn);

  return JSON.stringify(
    {
      success: true,
      message: 'Post deleted successfully',
      postUrn,
    },
    null,
    2
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const postTools = {
  create_post: {
    description:
      'Create a new post on a LinkedIn company/organization page. Supports text posts and link posts with previews. Use isDarkPost=true for ad-only content that won\'t appear on the page feed.',
    parameters: CreatePostInputSchema,
    handler: createPost,
  },
  list_posts: {
    description:
      'List recent posts from a LinkedIn company/organization page. Returns posts sorted by last modified date.',
    parameters: ListPostsInputSchema,
    handler: listPosts,
  },
  get_post: {
    description: 'Get details of a specific LinkedIn post by its URN',
    parameters: GetPostInputSchema,
    handler: getPost,
  },
  update_post: {
    description:
      'Update the text content of an existing LinkedIn post. Only the post author can update.',
    parameters: UpdatePostInputSchema,
    handler: updatePost,
  },
  delete_post: {
    description:
      'Delete a LinkedIn post. Only the post author can delete. This action is irreversible.',
    parameters: DeletePostInputSchema,
    handler: deletePost,
  },
};
