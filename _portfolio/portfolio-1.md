---
title: "Informative and Fast Exploration Planning Using UAV for Reconnaissance Operations"
excerpt: "**AirLab, The Robotics Institute, Carnegie Mellon University** <br/><img src='/images/UAV.gif'>"
permalink: "/Research/RISS2021"
collection: portfolio
date: 2021-8-14
---

- Proposed and developed Prioritized-FUEL (**F**ast **U**AV **E**xpLoration), a hierarchical approach for faster coverage, exploration 
and informative planning for reconnaissance and search & rescue operations
- Proposed method showed 2 times faster Data Acquisition with same exploration time compared to existent approach
- Helped in Development of simulation environment using ROS, AirSim, Unreal Engine and Gazebo.

<br/><img src='/images/2021-RISS-poster-Informative and Fast Exploration Planner Using UAV for Reconnaissance Operarions-NAVEED-Kaleb Ben-SCHERER.png'>

**Abstract:** In the missions related to search and rescue
operations, reconnaissance Unmanned Aerial Vehicles (UAV)
are used to effectively search the given environment map and
return information about the detected objects with limited
flight time. This involves solving the NP-hard problem of
maintaining balance between the tasks of fast exploration
and data acquisition. Most of the existing work focuses on
optimizing only one of these factors. In this paper, we propose
Prioritized-FUEL, which is built on top of the FUEL (Fast UAV
Exploration) algorithm, a frontier-based exploration technique.
The proposed hierarchical structure maintains balance between
fast coverage and data acquisition through the introduction
of two high-level planner options: Exploration planning and
Informative planning. In order to facilitate decision making for
informative planner, we modify Frontier Information Structure
(FIS) in the original FUEL paper to incorporate information
about objects of interest. Moreover, we introduce Frontier
Priority Que (FPQ) to store information about all the frontiers,
which have a higher probability of the presence of the objects of
interest near them. The results from the experiments in the light
UAV simulation environment show that the proposed method
resulted in almost 2 times faster data acquisition as compared
to the original FUEL algorithm.

[\[Download Paper\]](http://kalebbennaveed.github.io/files/RISS-Journal.pdf)
[\[Video\]](https://www.youtube.com/watch?v=TgL3opwGc6o&feature=youtu.be)
[\[Poster\]](https://drive.google.com/file/d/1EncPHyfMdN85xrcbtIPah7ncFmrBB_6D/view)
