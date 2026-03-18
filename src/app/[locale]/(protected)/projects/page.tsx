import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getProjectBoard } from "@/services/projects.service";

export default async function ProjectsPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const board = await getProjectBoard();

  const columns = [
    { key: "todo", title: "Todo", items: board.todo },
    { key: "doing", title: "In Progress", items: board.doing },
    { key: "done", title: "Done", items: board.done },
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{dictionary.projects.title}</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <Card key={column.key}>
            <CardHeader>
              <CardTitle>{column.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {column.items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Owner: {item.owner}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="outline">{item.id}</Badge>
                    <p className="text-xs text-muted-foreground">Due {item.due}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
