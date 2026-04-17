import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyllabusService {
  private readonly logger = new Logger(SyllabusService.name);

  constructor(private prisma: PrismaService) {}

  async updateUserSyllabus(userId: string, educationLevelId: string, streamId: string) {
    this.logger.log(
      `Updating syllabus for user ${userId}: level=${educationLevelId}, stream=${streamId}`,
    );
    
    const result = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        educationLevelId,
        streamId,
      },
      include: {
        educationLevel: true,
        stream: true,
      },
    });

    this.logger.log(
      `Syllabus updated: ${result.educationLevel?.name} - ${result.stream?.name}`,
    );
    
    return result;
  }

  async getUserSyllabus(userId: string) {
    return this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        educationLevel: true,
        stream: {
          include: {
            subjects: true,
          },
        },
      },
    });
  }

  async getAllEducationLevels() {
    return this.prisma.educationLevel.findMany({
      orderBy: { order: 'asc' },
      include: {
        streams: true,
      },
    });
  }

  async getEducationLevelById(id: string) {
    return this.prisma.educationLevel.findUnique({
      where: { id },
      include: {
        streams: {
          include: {
            subjects: true,
          },
        },
      },
    });
  }

  async getStreamsByLevelId(levelId: string) {
    return this.prisma.stream.findMany({
      where: { educationLevelId: levelId },
      include: {
        subjects: true,
      },
    });
  }

  async getSubjectsByStreamId(streamId: string) {
    return this.prisma.subject.findMany({
      where: { streamId },
    });
  }

  async seedEducationLevels() {
    const levels = [
      {
        name: 'Nursery',
        slug: 'nursery',
        order: 1,
        description: 'Early childhood education (Creche, Pre-Nursery, Nursery)',
        streams: [
          { name: 'General', slug: 'nursery-general', description: 'General nursery activities' },
        ],
      },
      {
        name: 'Primary',
        slug: 'primary',
        order: 2,
        description: 'Primary school education (Classes 1-6)',
        streams: [
          { name: 'General', slug: 'primary-general', description: 'General primary curriculum' },
        ],
      },
      {
        name: 'Lower Secondary',
        slug: 'lower-secondary',
        order: 3,
        description: 'College/Form 1 to Form 4',
        streams: [
          { name: 'General', slug: 'lower-secondary-general', description: 'General secondary curriculum' },
        ],
      },
      {
        name: 'Upper Secondary',
        slug: 'upper-secondary',
        order: 4,
        description: 'Lower Six to Upper Six (GCE Advanced Level)',
        streams: [
          { name: 'Science', slug: 'upper-science', description: 'Biology, Chemistry, Physics' },
          { name: 'Arts', slug: 'upper-arts', description: 'Literature, History, Geography' },
          { name: 'Commercial', slug: 'upper-commercial', description: 'Accounting, Economics, Business' },
          { name: 'Technical', slug: 'upper-technical', description: 'Technical Drawing, Applied Electricity' },
        ],
      },
      {
        name: 'High School',
        slug: 'high-school',
        order: 5,
        description: 'Year 1 to Year 6 ( anglophone system)',
        streams: [
          { name: 'Science', slug: 'high-school-science', description: 'Science stream' },
          { name: 'Arts', slug: 'high-school-arts', description: 'Arts stream' },
          { name: 'Commercial', slug: 'high-school-commercial', description: 'Commercial stream' },
          { name: 'Technical', slug: 'high-school-technical', description: 'Technical stream' },
        ],
      },
      {
        name: 'BTEC / IBC',
        slug: 'btc-ibc',
        order: 6,
        description: 'BTEC / International Baccalaureate',
        streams: [
          { name: 'BTEC', slug: 'btc', description: 'Business and Technology Education Council' },
          { name: 'IB', slug: 'ib', description: 'International Baccalaureate' },
        ],
      },
      {
        name: 'HND',
        slug: 'hnd',
        order: 7,
        description: 'Higher National Diploma (2-3 years)',
        streams: [
          { name: 'Computer Science', slug: 'hnd-cs', description: 'Computer Science' },
          { name: 'Business', slug: 'hnd-business', description: 'Business Management' },
          { name: 'Engineering', slug: 'hnd-engineering', description: 'Engineering' },
          { name: ' Tourism', slug: 'hnd-tourism', description: ' Tourism & Hospitality' },
          { name: 'Accounting', slug: 'hnd-accounting', description: 'Accounting' },
        ],
      },
      {
        name: 'BSc / BA',
        slug: 'bsc-ba',
        order: 8,
        description: "Bachelor's Degree (3-4 years)",
        streams: [
          { name: 'Computer Science', slug: 'bsc-cs', description: 'Computer Science' },
          { name: 'Medicine', slug: 'bsc-medicine', description: 'Medicine & Surgery' },
          { name: ' Engineering', slug: 'bsc-engineering', description: ' Engineering' },
          { name: 'Business', slug: 'bsc-business', description: 'Business Administration' },
          { name: 'Law', slug: 'bsc-law', description: 'Law' },
          { name: 'Arts', slug: 'bsc-arts', description: 'Arts & Humanities' },
          { name: 'Sciences', slug: 'bsc-sciences', description: 'Pure & Applied Sciences' },
          { name: 'Agriculture', slug: 'bsc-agriculture', description: 'Agriculture & Forestry' },
        ],
      },
      {
        name: 'PGDE / PGD',
        slug: 'pgde',
        order: 9,
        description: 'Postgraduate Diploma in Education (1 year)',
        streams: [
          { name: 'PGDE', slug: 'pgde', description: 'Postgraduate Diploma in Education' },
        ],
      },
      {
        name: "Master's",
        slug: 'masters',
        order: 10,
        description: "Master's Degree (1-2 years)",
        streams: [
          { name: 'MBA', slug: 'mba', description: 'Master of Business Administration' },
          { name: ' MSc', slug: 'msc', description: 'Master of Science' },
          { name: 'MA', slug: 'ma', description: 'Master of Arts' },
          { name: 'MEM', slug: 'mem', description: 'Master of Engineering Management' },
          {
            name: ' MPH',
            slug: 'mph',
            description: 'Master of Public Health'
          },
        ],
      },
      {
        name: 'PhD',
        slug: 'phd',
        order: 11,
        description: 'Doctor of Philosophy (3-5 years)',
        streams: [
          { name: 'PhD', slug: 'phd', description: 'Doctor of Philosophy' },
          { name: 'DBA', slug: 'dba', description: 'Doctor of Business Administration' },
        ],
      },
    ];

    const subjectsByStream: Record<string,string[]> = {
      'Science': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
      'Arts': ['Literature', 'History', 'Geography', 'Philosophy', 'French'],
      'Commercial': ['Accounting', 'Economics', 'Business Management', 'Commerce', 'French'],
      'Technical': ['Technical Drawing', 'Applied Electricity', 'Mechanics', 'Workshop Practice'],
      'General': ['Mathematics', 'English', 'French', 'Basic Science', 'Social Studies'],
    };

    for (const level of levels) {
      await this.prisma.educationLevel.upsert({
        where: { slug: level.slug },
        update: {},
        create: {
          name: level.name,
          slug: level.slug,
          order: level.order,
          description: level.description,
        },
      });

      for (const stream of level.streams) {
        await this.prisma.stream.upsert({
          where: { slug: stream.slug },
          update: {},
          create: {
            name: stream.name,
            slug: stream.slug,
            description: stream.description,
            educationLevel: {
              connect: { slug: level.slug },
            },
          },
        });
      }
    }

    return { message: 'Education levels seeded successfully' };
  }
}