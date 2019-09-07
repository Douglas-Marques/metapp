import * as Yup from 'yup';
import Enrollment from '../models/Enrollment';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

class EnrollmentController {
  async index(req, res) {
    const { page = 1 } = req.query;
    const enrollments = await Enrollment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      limit: 10,
      offset: (page - 1) * 10,
      attributes: ['canceledAt'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['path', 'url'],
            },
          ],
        },
        {
          model: Meetup,
          as: 'meetup',
          attributes: ['title', 'description', 'localization', 'date'],
          order: ['date'],
          include: [
            {
              model: File,
              as: 'banner',
              attributes: ['path', 'url'],
            },
          ],
        },
      ],
    });
    return res.json(enrollments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      meetup_id: Yup.number().required(),
    });
    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails' });
    const { meetup_id } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const meetup = await Meetup.findByPk(meetup_id);
    if (!meetup) return res.status(401).json({ error: 'Banner not found' });
    const enrollment = await Enrollment.create({
      user_id: req.userId,
      meetup_id,
    });
    return res.json({ enrollment });
  }

  async delete(req, res) {
    const enrollment = await Enrollment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
        {
          model: Meetup,
          as: 'meetup',
          attributes: ['title', 'description', 'localization', 'date'],
          include: [
            {
              model: File,
              as: 'banner',
              attributes: ['path', 'url'],
            },
          ],
        },
      ],
    });
    if (!enrollment)
      return res.status(400).json({
        error: 'Enrollment not found',
      });
    if (enrollment.user_id !== req.userId)
      return res.status(401).json({
        error: "You don't have permission to cancel this enrollment",
      });
    enrollment.canceledAt = new Date();
    await enrollment.save();
    return res.json(enrollment);
  }
}

export default new EnrollmentController();
