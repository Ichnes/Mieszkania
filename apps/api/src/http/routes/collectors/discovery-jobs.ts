import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { withDiscoveryProgress } from "../../../collectors/discovery-progress";

type ScanResult = { scannedPages: number; queued: number; stoppedBecause: string };
type Job = {
  id: string;
  source: string;
  status: "running" | "completed" | "error";
  result?: ScanResult;
  message?: string;
  finishedAt?: number;
};
const jobs = new Map<string, Job>();
const active = new Map<string, Job>();

function pruneJobs() {
  for (const [id, job] of jobs) {
    if (job.finishedAt && Date.now() - job.finishedAt > 60 * 60 * 1000) jobs.delete(id);
  }
}

export function registerDiscoveryJobRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/collectors/discovery-jobs/:id",
    async (request, reply) => {
      pruneJobs();
      const job = jobs.get(request.params.id);
      if (!job)
        return reply
          .code(404)
          .send({ message: "Nie znaleziono skanu. Serwer mógł zostać ponownie uruchomiony." });
      return job;
    },
  );
}

export function runDiscoveryRequest<T extends ScanResult>(
  request: FastifyRequest,
  reply: FastifyReply,
  source: string,
  run: () => Promise<T>,
) {
  if ((request.query as { background?: string }).background !== "1") {
    return withDiscoveryProgress(source, run);
  }
  pruneJobs();
  const running = active.get(source);
  if (running)
    return reply.code(409).send({ message: "Skan tego portalu już trwa.", jobId: running.id });
  const job: Job = { id: randomUUID(), source, status: "running" };
  jobs.set(job.id, job);
  active.set(source, job);
  void withDiscoveryProgress(source, run)
    .then(
      (result) => {
        job.result = result;
        job.status = "completed";
      },
      (error: unknown) => {
        job.message = error instanceof Error ? error.message : "Skan nie powiódł się.";
        job.status = "error";
      },
    )
    .finally(() => {
      job.finishedAt = Date.now();
      active.delete(source);
    });
  return reply.code(202).send({ jobId: job.id });
}
