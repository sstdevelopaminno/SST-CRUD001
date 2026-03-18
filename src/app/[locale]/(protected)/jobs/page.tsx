import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getJobs } from "@/services/jobs.service";

export default async function JobsPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const jobs = await getJobs();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.jobs.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.id}</TableCell>
                <TableCell>{job.title}</TableCell>
                <TableCell>{job.assignee}</TableCell>
                <TableCell>{job.priority}</TableCell>
                <TableCell>
                  <Badge variant={job.status === "Done" ? "success" : "secondary"}>{job.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
