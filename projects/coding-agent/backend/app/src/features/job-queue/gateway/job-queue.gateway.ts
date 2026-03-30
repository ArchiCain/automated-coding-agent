import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { Job, JobProgress } from '../models/job.model';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/jobs',
})
export class JobQueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(JobQueueGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected to jobs: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected from jobs: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, jobId: string): void {
    client.join(`job:${jobId}`);
    this.logger.debug(`Client ${client.id} subscribed to job ${jobId}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, jobId: string): void {
    client.leave(`job:${jobId}`);
    this.logger.debug(`Client ${client.id} unsubscribed from job ${jobId}`);
  }

  @OnEvent('job:created')
  handleJobCreated(payload: { job: Job }): void {
    this.server.emit('job:created', payload);
  }

  @OnEvent('job:started')
  handleJobStarted(payload: { job: Job }): void {
    this.server.emit('job:started', payload);
    this.server.to(`job:${payload.job.id}`).emit('job:started', payload);
  }

  @OnEvent('job:progress')
  handleJobProgress(payload: { jobId: string; progress: JobProgress }): void {
    this.server.emit('job:progress', payload);
    this.server.to(`job:${payload.jobId}`).emit('job:progress', payload);
  }

  @OnEvent('job:log')
  handleJobLog(payload: { jobId: string; line: string }): void {
    // Only send to subscribers of this specific job to avoid flooding
    this.server.to(`job:${payload.jobId}`).emit('job:log', payload);
  }

  @OnEvent('job:completed')
  handleJobCompleted(payload: { job: Job }): void {
    this.server.emit('job:completed', payload);
    this.server.to(`job:${payload.job.id}`).emit('job:completed', payload);
  }

  @OnEvent('job:failed')
  handleJobFailed(payload: { job: Job; error: string }): void {
    this.server.emit('job:failed', payload);
    this.server.to(`job:${payload.job.id}`).emit('job:failed', payload);
  }

  @OnEvent('job:cancelled')
  handleJobCancelled(payload: { job: Job }): void {
    this.server.emit('job:cancelled', payload);
    this.server.to(`job:${payload.job.id}`).emit('job:cancelled', payload);
  }
}
