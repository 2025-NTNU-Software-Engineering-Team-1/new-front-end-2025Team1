// 討論區貼文相關類型定義

export interface DiscussionPost {
  Post_Id: number;
  Author: string;
  Title: string;
  Created_Time: string;
  Like_Count: number;
  Reply_Count: number;
  Is_Pinned: boolean;
  Is_Closed?: boolean;
  Content?: string;
  Category?: string;
  Is_Solved?: boolean;
  Problem_id?: string;
  Language?: string;
  Contains_Code?: boolean;
}

export interface DiscussionPostDetail extends DiscussionPost {
  Content: string;
  Category: string;
  Is_Solved: boolean;
  Is_Closed: boolean;
  Replies: DiscussionReply[];
}

export interface DiscussionReply {
  Reply_ID: number;
  Post_Id: number;
  Author: string;
  Content: string;
  Created_Time: string;
  Reply_To?: number;
  Contains_Code?: boolean;
  Like_Count?: number;
  Is_Liked?: boolean;
}

export interface DiscussionProblem {
  Problem_Id: number;
  Problem_Name: string;
}

export interface DiscussionMeta {
  Role: string;
  Deadline: string;
  Code_Allowed: boolean;
}

// API 請求參數類型
export interface GetPostsParams {
  Mode?: string; // "New" | "Hot"
  Limit?: number;
  Page?: number;
  Problem_Id?: string;
}

export interface SearchPostsParams {
  Words: string;
  Limit?: number;
  Page?: number;
}

export interface CreatePostParams {
  Title: string;
  Content: string;
  Problem_id?: string;
  Category?: string;
  Language?: string;
  Contains_Code?: boolean;
}

export interface CreateReplyParams {
  Reply_To?: number;
  Content: string;
  Contains_Code?: boolean;
}

export interface LikeActionParams {
  ID: number;
  Action: boolean; // true = 按讚, false = 取消按讚
}

export interface ManagePostStatusParams {
  Action: string; // "pin" | "close" | "solved" | "delete"
}

export interface DeleteParams {
  Type: string; // "post" | "reply"
  Id: number;
}

// API 回應類型
export interface ApiResponse {
  Status: "OK" | "ERR";
  Message?: string;
  [key: string]: unknown;
}

export interface GetPostsResponse extends ApiResponse {
  Posts: DiscussionPost[];
}

export interface SearchPostsResponse extends ApiResponse {
  Post: DiscussionPost[];
}

export interface CreatePostResponse extends ApiResponse {
  Post_ID: number;
}

export interface CreateReplyResponse extends ApiResponse {
  Reply_ID: number;
}

export interface LikeActionResponse extends ApiResponse {
  Like_Count: number;
  Like_Status: boolean;
}

export interface GetPostDetailResponse extends ApiResponse {
  Post: DiscussionPostDetail[];
}

export interface ManagePostStatusResponse extends ApiResponse {
  New_Status: string;
}

export interface DeleteResponse extends ApiResponse {
  Message: string;
}

export interface GetProblemsResponse extends ApiResponse {
  Problems: DiscussionProblem[];
}

export interface GetProblemMetaResponse extends ApiResponse {
  Role: string;
  Deadline: string;
  Code_Allowed: boolean;
}

// 前端內部使用的類型
export interface PostSortMode {
  value: "New" | "Hot";
  label: string;
}

export interface PostCategory {
  value: string;
  label: string;
}

export interface PostLanguage {
  value: string;
  label: string;
}

// 分� �相關
export interface PaginationInfo {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
}

// 搜尋相關
export interface SearchFilters {
  query: string;
  category?: string;
  problemId?: string;
  sortMode: "New" | "Hot";
}
