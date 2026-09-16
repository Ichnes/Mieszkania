type Fetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Keep each HTTP request short even when a portal scan takes many minutes. */
export async function discoveryRequest(
  fetcher: Fetch,
  url: string,
  options: RequestInit,
  wait = () => new Promise<void>((resolve) => setTimeout(resolve, 2000)),
): Promise<Response> {
  const response = await fetcher(`${url}?background=1`, options);
  if (response.status !== 202 && response.status !== 409) return response;
  const accepted = await response.clone().json();
  if (!accepted.jobId) return response;
  const statusUrl = `${url.slice(0, url.indexOf("/api/collectors/"))}/api/collectors/discovery-jobs/${encodeURIComponent(accepted.jobId)}`;
  let failures = 0;
  while (true) {
    await wait();
    let status: Response;
    try {
      status = await fetcher(statusUrl);
    } catch (error) {
      if (++failures < 3) continue;
      throw error;
    }
    if (!status.ok) {
      if (status.status >= 500 && ++failures < 3) continue;
      return status;
    }
    failures = 0;
    const job = await status.json();
    if (job.status === "completed") return Response.json(job.result);
    if (job.status === "error") {
      return Response.json({
        stoppedBecause: "error",
        error: job.message,
        scannedPages: 0,
        queued: 0,
      });
    }
  }
}
