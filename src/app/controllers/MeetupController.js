import * as Yup from 'yup';
import { parseISO, isBefore, startOfDay, endOfDay } from 'date-fns';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

const { Op } = require('sequelize');

class MeetupController {
  async index(req, res) {
    const { date, page = 1 } = req.query;
    let searchDate;
    if (!date) searchDate = Number(new Date());
    else searchDate = Number(parseISO(date));
    const meetups = await Meetup.findAll({
      where: {
        canceled_at: null,
        date: {
          [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
        },
      },
      order: ['date'],
      limit: 10,
      offset: (page - 1) * 10,
      attributes: ['title', 'description', 'localization', 'date', 'past'],
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
          model: File,
          as: 'banner',
          attributes: ['path', 'url'],
        },
      ],
    });
    return res.json(meetups);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      banner_id: Yup.number().required(),
      date: Yup.date().required(),
      title: Yup.string().required(),
      description: Yup.string().required(),
      localization: Yup.string().required(),
    });
    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails' });
    const { banner_id, date, title, description, localization } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const file = await File.findByPk(banner_id);
    if (!file) return res.status(401).json({ error: 'Banner not found' });
    if (isBefore(parseISO(date), new Date()))
      return res.status(400).json({ error: 'Past date are not permitted' });
    const meetup = await Meetup.create({
      user_id: req.userId,
      banner_id,
      date,
      title,
      description,
      localization,
    });
    return res.json({ meetup });
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      banner_id: Yup.number(),
      date: Yup.date(),
      title: Yup.string(),
      description: Yup.string(),
      localization: Yup.string(),
    });
    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Validation fails' });
    const { banner_id, date } = req.body;
    const meetup = await Meetup.findByPk(req.params.id);
    if (!meetup) return res.status(401).json({ error: 'Meetup not found' });
    if (meetup.user_id !== req.userId)
      return res.status(401).json({
        error: "You don't have permission to edit this appointment",
      });
    if (isBefore(parseISO(meetup.date), new Date()))
      return res.status(400).json({ error: 'Past meetups are not editable' });
    if (banner_id) {
      const file = await File.findByPk(banner_id);
      if (!file) return res.status(401).json({ error: 'Banner not found' });
    }
    if (date && isBefore(parseISO(date), new Date()))
      return res.status(400).json({ error: 'Past date are not permitted' });
    const newMeetup = await meetup.update(req.body, {
      new: true,
    });
    return res.json(newMeetup);
  }

  async delete(req, res) {
    const meetup = await Meetup.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
        {
          model: File,
          as: 'banner',
          attributes: ['path', 'url'],
        },
      ],
    });
    if (meetup.user_id !== req.userId)
      return res.status(401).json({
        error: "You don't have permission to cancel this meetup",
      });
    meetup.canceledAt = new Date();
    await meetup.save();
    return res.json(meetup);
  }
}

export default new MeetupController();
