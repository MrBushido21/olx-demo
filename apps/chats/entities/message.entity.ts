import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatsEntity } from './chat.entity';

@Entity()
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ nullable: true, type: 'text' })
  content?: string;

  @Column({ nullable: true })
  url?: string;

  @Column({ nullable: true })
  public_id?: string;

  @CreateDateColumn()
  created_at!: Date

  @Column()
  chatId!: string;
  
  @ManyToOne(() => ChatsEntity, (chat) => chat.messages, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'chatId'})
  chat!: ChatsEntity
}