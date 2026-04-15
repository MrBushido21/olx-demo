import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { MessageEntity } from './message.entity';

@Entity()
export class ChatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Объявление, к которому относится чат
  @Column()
  listingId!: string;

  // Покупатель — тот кто начал чат
  @Column()
  buyerId!: string;

  // Продавец — владелец объявления
  @Column()
  sellerId!: string;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => MessageEntity, (message) => message.chat, { cascade: true })
  messages!: MessageEntity[];
}