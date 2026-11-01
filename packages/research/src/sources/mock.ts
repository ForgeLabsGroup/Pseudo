import type { SocialSource } from '../types';

/** Demo/offline source: fake video + post metadata, no network. */
export function createMockSource(): SocialSource {
  return {
    name: 'mock',
    async getRecentVideos(handles, limit) {
      const platform = handles.tiktok ? 'tiktok' : handles.instagram ? 'instagram' : 'youtube';
      return Array.from({ length: limit }, (_, i) => ({
        platform,
        postUrl: `https://mock.pseudo.app/${platform}/${Object.values(handles)[0] ?? 'creator'}/${i}`,
        videoUrl: null,
        caption: `Mock video ${i + 1}`,
        postedAt: null,
        views: 100_000 * (i + 1),
      }));
    },
    async getRecentPosts(handles, limit) {
      if (!handles.x) return [];
      return Array.from({ length: limit }, (_, i) => ({
        text: `Mock post ${i + 1}`,
        url: null,
        postedAt: null,
        likes: 1000,
      }));
    },
  };
}
