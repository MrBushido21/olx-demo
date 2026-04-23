import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { MessageEntity } from './message.entity';
import { ChatImgEntity } from './chatImages.entity';

@Entity()
@Unique(['buyerId', 'sellerId', 'listingId'])
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

  @OneToMany(() => ChatImgEntity, (image) => image.chat)
  images!: ChatImgEntity[]
}