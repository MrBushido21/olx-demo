import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Listings } from "./listings.entity";

@Entity()

export class ListingImages {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    imageUrl: string

    @Column()
    imageKey: string

    @ManyToOne(() => Listings, (listing) => listing.images, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'listingId' })
    listings: Listings;

    @Column({ name: 'listingId' })
    listingId: string;
}