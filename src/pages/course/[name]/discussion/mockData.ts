export type Post = {
  id: string;
  author: string;
  avatarColor?: string;
  time: string;
  title: string;
  excerpt: string;
  likes: number;
  comments: number;
  views: number;
  tags?: string[];
};

export const samplePosts: Post[] = [
  {
    id: '1',
    author: 'Alice',
    avatarColor: '#F59E0B',
    time: '2h',
    title: 'TitleTitle Title Title',
    excerpt: 'article......',
    likes: 9,
    comments: 9,
    views: 42,
    tags: ['python'],
  },
  {
    id: '2',
    author: 'Bob',
    avatarColor: '#10B981',
    time: '1d',
    title: 'Another interesting topic',
    excerpt: 'Some short excerpt for the post...',
    likes: 3,
    comments: 1,
    views: 18,
    tags: ['c'],
  },
  {
    id: '3',
    author: 'Carol',
    avatarColor: '#6366F1',
    time: '3d',
    title: 'Question about algorithms',
    excerpt: 'Can someone explain the solution approach?',
    likes: 12,
    comments: 4,
    views: 80,
    tags: ['algorithm', 'python'],
  },
];
