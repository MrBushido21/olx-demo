import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Listings } from "./listings.entity";

@Entity()
export class ReviewEntity {
    @PrimaryGeneratedColumn('uuid')
    id!:string

    @Column()
    review!:string

    @Column()
    userId!:string

    @Column()
    listingId!:string

    @ManyToOne(() => Listings, (listing) => listing.rewies, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'listingId' })
    listings!: Listings;

    @CreateDateColumn()
    created_at!:Date
}