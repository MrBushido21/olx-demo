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

  @Column('text')
  content!: string;

  @CreateDateColumn()
  created_at!: Date

  @Column()
  chatId!: string;
  
  @ManyToOne(() => ChatsEntity, (chat) => chat.messages, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'chatId'})
  chat!: ChatsEntity
}