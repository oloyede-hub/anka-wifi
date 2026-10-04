import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
export class BulkCreateAccessCodesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Length(8, 8, { each: true })
  @Matches(/^\S{8}$/, { each: true })
  codes: string[];
}
