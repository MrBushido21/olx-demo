import { Column, Entity,PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";

  @Entity('user_refresh_tokens')
  export class UserRefreshTokens {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column()
      refreshToken: string;

      @CreateDateColumn({type:'date'})
      created_at: Date

      @Column({type:'date'})
      expired_at: Date

      @Column()
      userId: string;
  }