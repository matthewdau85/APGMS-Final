import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

export function ErrorState({
  title = "Something went wrong",
  description,
  actionLabel = "Retry",
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-6">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div className="space-y-2">
          <div className="font-semibold">{title}</div>
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
          {onAction ? (
            <Button variant="outline" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
