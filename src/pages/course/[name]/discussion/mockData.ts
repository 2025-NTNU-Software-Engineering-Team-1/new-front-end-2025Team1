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
  problemId?: string;
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
  {
    id: '4',
    author: 'Carol',
    avatarColor: '#6366F1',
    time: '5d',
    title: 'Question about data structures',
    excerpt: 'Can someone explain the solution approach?',
    likes: 100,
    comments: 10,
    views: 100,
    tags: ['data structures', 'python'],
  },
  {
    id: '5',
    author: 'David',
    avatarColor: '#8B5CF6',
    time: '1d',
    title: 'Help with Problem 1001',
    excerpt: 'I am stuck on this problem, can someone give me a hint?',
    likes: 5,
    comments: 3,
    views: 25,
    tags: ['help'],
    problemId: '1001',
  },
  {
    id: '6',
    author: 'Eva',
    avatarColor: '#EC4899',
    time: '3d',
    title: 'Alternative solution for Problem 1001',
    excerpt: 'I found a different approach to solve this problem...',
    likes: 8,
    comments: 2,
    views: 35,
    tags: ['solution'],
    problemId: '1001',
  },
  {
    id: '7',
    author: 'Frank',
    avatarColor: '#F59E0B',
    time: '2d',
    title: 'Time complexity question for Problem 1002',
    excerpt: 'What is the optimal time complexity for this problem?',
    likes: 12,
    comments: 5,
    views: 50,
    tags: ['complexity'],
    problemId: '1002',
  },
];

export function addPost(p: Omit<Post, 'id' | 'time'> & { time?: string }) {
  const id = String(Date.now());
  const time = p.time ?? 'just now';
  const newPost: Post = { ...p, id, time };
  samplePosts.unshift(newPost);
  return newPost;
}
