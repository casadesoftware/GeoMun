import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'geomun';
    this.s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://storage:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      console.log(`[Storage] Bucket "${this.bucket}" ya existe`);
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      console.log(`[Storage] Bucket "${this.bucket}" creado`);
    }
  }

  async upload(key: string, body: Buffer, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, bucket: this.bucket };
  }

  async download(key: string) {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return response;
  }

  async delete(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return { deleted: true };
  }
}
