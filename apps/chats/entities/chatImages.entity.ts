import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ChatsEntity } from "./chat.entity";

@Entity()

export class ChatImgEntity {
    @PrimaryGeneratedColumn('uuid')
    id!:string

    @Column()
    userId!: string

    @Column()
    url!: string
    
    @Column()
    public_id!: string

    @CreateDateColumn()
    created_at!: Date

    @Column()
    chatId!:string

    @ManyToOne(() => ChatsEntity, (chat) => chat.images, {onDelete: 'CASCADE'})
    @JoinColumn({ name: 'chatId' })
    chat!: ChatsEntity

}