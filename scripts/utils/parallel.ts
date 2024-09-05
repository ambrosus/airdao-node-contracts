export class Parallel {
  private queue: (() => Promise<any>)[] = [];
  private results: any = [];
  private readonly maxParallelCount: number;
  private nowRunningCount = 0;
  private doneFunc?: (res?: any) => void;

  constructor(parallelCount: number) {
    this.maxParallelCount = parallelCount;
  }

  addTask(task: () => Promise<any>) {
    this.queue.push(task);
    this.checkQueue();
  }

  async wait() {
    if (this.nowRunningCount > 0)
      await new Promise(resolve => {
        this.doneFunc = resolve;
      });
    return this.results;
  }

  private checkQueue() {
    if (this.nowRunningCount >= this.maxParallelCount) return;
    if (this.queue.length == 0) {
      if (this.nowRunningCount == 0)
        if (this.doneFunc) this.doneFunc();
      return;
    }

    const task = this.queue.shift()!;
    this.nowRunningCount++;
    task().then(res => {
      this.results.push(res);
      this.nowRunningCount--;
      this.checkQueue();
    });
  }

}
