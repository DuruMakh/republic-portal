"use client";
import { useCallback, useState } from "react";
import { Card } from "@/components/Card";
import { AdminSectionTitle } from "@/components/AdminUi";
import { ArticleActions } from "./ArticleActions";
import { CoverUpload } from "./CoverUpload";
import { NewsForm, type EditableArticle } from "./NewsForm";
export function NewsEditor({
  article,
  status,
  everPublished,
  imageUrl,
}: {
  article: EditableArticle;
  status: "draft" | "published";
  everPublished: boolean;
  imageUrl: string | null;
}) {
  const [publishBlocked, setPublishBlocked] = useState(false);
  const onEditStateChange = useCallback((dirty: boolean, saving: boolean) => {
    setPublishBlocked(dirty || saving);
  }, []);
  return (
    <>
      <NewsForm article={article} onEditStateChange={onEditStateChange} />
      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <AdminSectionTitle className="mb-5">ყდის სურათი</AdminSectionTitle>
          <CoverUpload newsId={article.id} imageUrl={imageUrl} />
        </Card>
        <Card>
          <AdminSectionTitle className="mb-5">მოქმედებები</AdminSectionTitle>
          <ArticleActions
            id={article.id}
            status={status}
            everPublished={everPublished}
            publishBlocked={publishBlocked}
          />
        </Card>
      </div>
    </>
  );
}
