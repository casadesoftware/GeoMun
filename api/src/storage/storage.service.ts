import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
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
    await this.setBucketPublicRead();
  }

  private async setBucketPublicRead() {
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${this.bucket}/*`],
      }],
    };
    try {
      await this.s3.send(new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify(policy),
      }));
      console.log(`[Storage] Política pública aplicada`);
    } catch (e) {
      console.error(`[Storage] Error al aplicar política:`, e);
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

  async listByPrefix(prefix: string): Promise<string[]> {
    const response = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    );
    return (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);
  }

}
