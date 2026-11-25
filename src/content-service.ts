import { articles } from "./data";
import type { Article } from "./model";
export const articleProvider = {
  list(): Article[] {
    return articles;
  },
  get(id: string): Article | undefined {
    return articles.find((article) => article.id === id);
  },
};
