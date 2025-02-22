---
title: "Trajectory Planning for Autonomous Vehicles Using Hierarchical
Reinforcement Learning"
collection: publications
permalink: /publication/2021-09-21-IEEE-ITSC-2021
excerpt: ''
date: 2021-09-21
venue: 'IEEE International Transportation Systems Conference'
citation: 'K. B. Naveed, Z. Qiao, and J. M. Dolan, “Trajectory Planning for Autonomous Vehicles Using Hierarchical Reinforcement Learning,” in Proceedings of IEEE Intelligent Transportation Systems Conference (ITSC) 2021, pp. 601 - 606, September 2021.'
---

**Abstract:**
Planning safe trajectories under uncertain and
dynamic conditions makes the autonomous driving problem
significantly complex. Current heuristic-based algorithms such
as the slot-based method rely heavily on hand-engineered
parameters and are restricted to specific scenarios. Supervised
learning methods such as Imitation Learning lack generalization and safety guarantees. To address these problems
and to ensure a robust framework, we propose a Robust-Hierarchical Reinforcement Learning (HRL) framework for
learning autonomous driving policies. We adapt a state-of-the-art algorithm, Hierarchical Double Deep Q-learning (h-DDQN), and make the framework robust by (1) constituting
the decision of selecting driving maneuver as a high-level
option; (2) for the lower-level controller, outputting waypoint
trajectories to track with a Proportional-Integral-Derivative
(PID) controller instead of direct acceleration/steering actions;
and (3) using a Long-Short-Term-Memory (LSTM) layer in
the network to alleviate the effects of observation noise and
dynamic driving behaviors. Moreover, to improve the sample efficiency, we use Hybrid Reward Mechanism and Reward-Driven
Exploration. Results from the high-fidelity CARLA simulator
while simulating different interactive lane change scenarios
indicate that the proposed framework reduces convergence
time, generates smoother trajectories, and can better handle
dynamic surroundings and noisy observations as compared to
other traditional RL approaches.


[\[Dowload Paper\]](http://kalebbennaveed.github.io/files/IEEE-ITSC.pdf) 
[\[Code\]](https://github.com/kalebbennaveed/Trajectory-Planning-for-Autonomous-Vehicles-Using-HRL)
[\[Video\]](https://www.youtube.com/watch?v=R5nWhzCBLFs)
[\[Poster\]](https://drive.google.com/file/d/15qokfFeEeFlzD3C1tuk1sw8CKSsrbiBG/view)
