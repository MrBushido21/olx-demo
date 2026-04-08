import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Users } from "./user.entity";

@Entity()
export class FavoritesEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    listingId!: string

    @ManyToOne(() => Users, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'userId' })

    @Column()
    userId!: string

    @CreateDateColumn({ type: 'date' })
    created_at!: Date;
}