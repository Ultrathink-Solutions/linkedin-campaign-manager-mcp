import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  postTools,
} from '../../../src/tools/posts.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for post (Share on LinkedIn) tool handlers.
 */

describe('Post Tools', () => {
  let mockClient: LinkedInClient;

  beforeEach(() => {
    mockClient = {
      finder: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      partialUpdate: vi.fn(),
      delete: vi.fn(),
    } as unknown as LinkedInClient;
  });

  describe('createPost', () => {
    it('creates a text post', async () => {
      const mockResponse = {
        id: 'urn:li:share:123456',
        author: 'urn:li:organization:789',
        commentary: 'Hello world!',
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      const result = await createPost(
        { organizationId: '789', text: 'Hello world!' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.create).toHaveBeenCalledWith(
        '/posts',
        expect.objectContaining({
          author: 'urn:li:organization:789',
          commentary: 'Hello world!',
          visibility: 'PUBLIC',
          lifecycleState: 'PUBLISHED',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
        })
      );
      expect(parsed.message).toBe('Post published successfully to company page');
      expect(parsed.postUrn).toBe('urn:li:share:123456');
    });

    it('creates a dark post for ads', async () => {
      const mockResponse = {
        id: 'urn:li:share:999',
        author: 'urn:li:organization:789',
        commentary: 'Ad copy',
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      const result = await createPost(
        { organizationId: '789', text: 'Ad copy', isDarkPost: true },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.create).toHaveBeenCalledWith(
        '/posts',
        expect.objectContaining({
          distribution: expect.objectContaining({
            feedDistribution: 'NONE',
          }),
        })
      );
      expect(parsed.message).toBe('Dark post created successfully (not visible on company page)');
    });

    it('includes link URL when provided', async () => {
      const mockResponse = {
        id: 'urn:li:share:555',
        author: 'urn:li:organization:789',
        commentary: 'Check this out',
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      await createPost(
        {
          organizationId: '789',
          text: 'Check this out',
          linkUrl: 'https://example.com',
        },
        mockClient
      );

      expect(mockClient.create).toHaveBeenCalledWith(
        '/posts',
        expect.objectContaining({
          content: {
            article: {
              source: 'https://example.com',
              title: '',
            },
          },
        })
      );
    });

    it('throws ValidationError when API returns no post ID', async () => {
      vi.mocked(mockClient.create).mockResolvedValue({});

      await expect(
        createPost({ organizationId: '789', text: 'Test' }, mockClient)
      ).rejects.toThrow('LinkedIn API did not return a post URN');
    });
  });

  describe('listPosts', () => {
    it('lists posts for an organization', async () => {
      const mockResponse = {
        elements: [
          {
            id: 'urn:li:share:111',
            author: 'urn:li:organization:789',
            commentary: 'Post one',
            visibility: 'PUBLIC',
            lifecycleState: 'PUBLISHED',
          },
          {
            id: 'urn:li:share:222',
            author: 'urn:li:organization:789',
            commentary: 'Post two',
            visibility: 'PUBLIC',
            lifecycleState: 'PUBLISHED',
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await listPosts({ organizationId: '789' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith('/posts', 'author', {
        author: 'urn:li:organization:789',
        count: 10,
        start: 0,
        sortBy: 'LAST_MODIFIED',
      });
      expect(parsed.count).toBe(2);
      expect(parsed.posts[0].id).toBe('111');
    });

    it('respects pagination parameters', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await listPosts({ organizationId: '789', count: 50, start: 10 }, mockClient);

      expect(mockClient.finder).toHaveBeenCalledWith('/posts', 'author', {
        author: 'urn:li:organization:789',
        count: 50,
        start: 10,
        sortBy: 'LAST_MODIFIED',
      });
    });

    it('handles missing elements in response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({});

      const result = await listPosts({ organizationId: '789' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.count).toBe(0);
      expect(parsed.posts).toEqual([]);
    });
  });

  describe('getPost', () => {
    it('gets a specific post by URN with URL encoding', async () => {
      const mockResponse = {
        id: 'urn:li:share:123',
        author: 'urn:li:organization:789',
        commentary: 'Test post',
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
        createdAt: 1706400000000,
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getPost({ postUrn: 'urn:li:share:123' }, mockClient);
      const parsed = JSON.parse(result);

      // URN is URL-encoded before API call
      expect(mockClient.get).toHaveBeenCalledWith(
        '/posts',
        encodeURIComponent('urn:li:share:123')
      );
      expect(parsed.id).toBe('123');
      expect(parsed.text).toBe('Test post');
    });
  });

  describe('updatePost', () => {
    it('updates post text', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);

      const result = await updatePost(
        { postUrn: 'urn:li:share:123', text: 'Updated text' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/posts',
        encodeURIComponent('urn:li:share:123'),
        { commentary: 'Updated text' }
      );
      expect(parsed.message).toBe('Post updated successfully');
      expect(parsed.success).toBe(true);
    });
  });

  describe('deletePost', () => {
    it('deletes a post', async () => {
      vi.mocked(mockClient.delete).mockResolvedValue(undefined);

      const result = await deletePost({ postUrn: 'urn:li:share:123' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith(
        '/posts',
        encodeURIComponent('urn:li:share:123')
      );
      expect(parsed.message).toBe('Post deleted successfully');
      expect(parsed.success).toBe(true);
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(postTools).toHaveProperty('create_post');
      expect(postTools).toHaveProperty('list_posts');
      expect(postTools).toHaveProperty('get_post');
      expect(postTools).toHaveProperty('update_post');
      expect(postTools).toHaveProperty('delete_post');

      for (const tool of Object.values(postTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
